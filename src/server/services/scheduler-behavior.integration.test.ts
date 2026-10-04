/**
 * Task 5.2 — cross-stage scheduler behavior (synthetic fixtures only).
 * Distinguishes job creation, provider acceptance (mock), not device observation.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { and, eq, inArray } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";
import {
  createEphemeralDb,
  insertUser,
  rethrowIfMigrationFailure,
  type EphemeralDb,
} from "../db/test-db";
import {
  activitySeries,
  notificationJobs,
  routineSchedules,
  routineSteps,
  routines,
  schedulerRuns,
  userSettings,
} from "../db/schema";
import { deliverDueNotificationJobs } from "./notification-delivery";
import { computeNotificationJobs } from "./notifications";
import { materializeRoutines } from "./routine-materializer";
import {
  failSchedulerRun,
  getSchedulerHealth,
  startSchedulerRun,
  succeedSchedulerRun,
} from "./scheduler-runs";
import type { PushDeliveryResult } from "./push";

const TICK_NOW = new Date("2026-07-28T12:00:00.000Z");
const PROVIDER_ACCEPTED: PushDeliveryResult = {
  configured: true,
  subscriptions: 1,
  sent: 1,
  pruned: 0,
  retryableFailures: 0,
};

let env: EphemeralDb | null = null;
let dbAvailable = false;

beforeAll(async () => {
  try {
    env = await createEphemeralDb();
    dbAvailable = true;
  } catch (error) {
    rethrowIfMigrationFailure(error);
  }
}, 60_000);

afterAll(async () => {
  await env?.teardown();
}, 60_000);

const itDb = (name: string, fn: () => Promise<void>) =>
  it(name, async ({ skip }) => {
    if (!dbAvailable || !env) {
      console.warn(`[SKIP] ${name}: Postgres unavailable`);
      skip(true, "Postgres unavailable");
      return;
    }
    await fn();
  });

async function runTickPipeline(input: {
  now: Date;
  send?: typeof import("./push").sendToUser;
}) {
  const db = env!.db;
  const startedAt = input.now;
  const runId = await startSchedulerRun(db, startedAt);
  const materialize = await materializeRoutines({ db });
  const notifications = await computeNotificationJobs({ db, now: input.now });
  const delivery = await deliverDueNotificationJobs({
    db,
    now: input.now,
    send: input.send,
  });
  await succeedSchedulerRun(db, runId, input.now, {
    materialize,
    notifications,
    delivery,
  });
  return { runId, materialize, notifications, delivery };
}

describe("Task 5.2 scheduler pipeline", () => {
  itDb("keeps at most one row per dedup identity under concurrent computes", async () => {
    const userId = uuidv7();
    await insertUser(env!.db, userId);
    await env!.db.insert(userSettings).values({
      userId,
      timezone: "UTC",
      notificationPrefs: {
        reviewTodayNudges: false,
        weeklyReviewNudges: false,
      },
    });
    const seriesId = uuidv7();
    await env!.db.insert(activitySeries).values({
      id: seriesId,
      userId,
      tz: "UTC",
      dtstartLocal: new Date("2026-07-28T14:00:00.000Z"),
      title: "Focus block",
      durationMin: 30,
    });

    await Promise.all([
      computeNotificationJobs({ db: env!.db, now: TICK_NOW }),
      computeNotificationJobs({ db: env!.db, now: TICK_NOW }),
    ]);

    const active = await env!.db
      .select()
      .from(notificationJobs)
      .where(
        and(
          eq(notificationJobs.userId, userId),
          inArray(notificationJobs.state, ["pending", "retry", "processing"]),
        ),
      );
    const dedupKeys = active.map((job) => job.dedupKey);
    expect(new Set(dedupKeys).size).toBe(dedupKeys.length);
    expect(active.length).toBeGreaterThan(0);
  });

  itDb("serializes concurrent materialize ticks via advisory lock", async () => {
    const userId = uuidv7();
    await insertUser(env!.db, userId);
    const routineId = uuidv7();
    const scheduleId = uuidv7();
    await env!.db.insert(routines).values({
      id: routineId,
      userId,
      title: "Evening wind-down",
    });
    await env!.db.insert(routineSteps).values({
      id: uuidv7(),
      userId,
      routineId,
      title: "Tea",
      durationMin: 10,
      sortOrder: 0,
    });
    await env!.db.insert(routineSchedules).values({
      id: scheduleId,
      userId,
      routineId,
      tz: "UTC",
      rrule: "FREQ=DAILY",
      paused: false,
      nextRunAt: new Date(Date.now() - 2 * 60 * 60_000),
    });

    const [first, second] = await Promise.all([
      materializeRoutines({ db: env!.db }),
      materializeRoutines({ db: env!.db }),
    ]);
    const materializedTotal = first.materialized + second.materialized;
    const series = await env!.db
      .select()
      .from(activitySeries)
      .where(
        and(
          eq(activitySeries.userId, userId),
          eq(activitySeries.source, "routine"),
        ),
      );
    const forSchedule = series.filter((row) =>
      row.sourceRef?.startsWith(`${scheduleId}|`),
    );
    expect(forSchedule.length).toBe(materializedTotal);
    expect(materializedTotal).toBeGreaterThan(0);
  });

  itDb("backfills routine occurrences after a missed tick within the 24h window", async () => {
    const userId = uuidv7();
    await insertUser(env!.db, userId);
    const routineId = uuidv7();
    const scheduleId = uuidv7();
    const twentyThreeHoursAgo = new Date(Date.now() - 23 * 60 * 60_000);
    await env!.db.insert(routines).values({
      id: routineId,
      userId,
      title: "Morning",
    });
    await env!.db.insert(routineSteps).values({
      id: uuidv7(),
      userId,
      routineId,
      title: "Stretch",
      durationMin: 15,
      sortOrder: 0,
    });
    await env!.db.insert(routineSchedules).values({
      id: scheduleId,
      userId,
      routineId,
      tz: "UTC",
      rrule: "FREQ=DAILY",
      paused: false,
      nextRunAt: twentyThreeHoursAgo,
    });

    const result = await materializeRoutines({ db: env!.db });
    expect(result.materialized).toBeGreaterThan(0);
    const [sched] = await env!.db
      .select()
      .from(routineSchedules)
      .where(eq(routineSchedules.id, scheduleId));
    expect(sched!.nextRunAt!.getTime()).toBeGreaterThan(Date.now() - 60_000);
  });

  itDb("recovers scheduler health after a failed run mimicking process restart", async () => {
    await env!.db.delete(schedulerRuns);
    const processStartedAt = new Date(TICK_NOW.getTime() - 60 * 60_000);
    const successId = await startSchedulerRun(
      env!.db,
      new Date(TICK_NOW.getTime() - 10 * 60_000),
    );
    await succeedSchedulerRun(
      env!.db,
      successId,
      new Date(TICK_NOW.getTime() - 9 * 60_000),
      {},
    );
    const crashId = await startSchedulerRun(
      env!.db,
      new Date(TICK_NOW.getTime() - 5 * 60_000),
    );
    await failSchedulerRun(env!.db, crashId, TICK_NOW, "worker exited mid-tick");

    await expect(
      getSchedulerHealth({
        db: env!.db,
        now: TICK_NOW,
        configured: true,
        processStartedAt,
      }),
    ).resolves.toMatchObject({ state: "failed" });

    const recoveryId = await startSchedulerRun(
      env!.db,
      new Date(TICK_NOW.getTime() - 30_000),
    );
    await succeedSchedulerRun(
      env!.db,
      recoveryId,
      TICK_NOW,
      { delivery: { delivered: 0 } },
    );
    await expect(
      getSchedulerHealth({
        db: env!.db,
        now: TICK_NOW,
        configured: true,
        processStartedAt,
      }),
    ).resolves.toMatchObject({ state: "ok", lagSeconds: 0 });
  });

  itDb("tracks job created vs provider accepted without claiming device observation", async () => {
    const userId = uuidv7();
    await insertUser(env!.db, userId);
    await env!.db.insert(userSettings).values({
      userId,
      timezone: "UTC",
      notificationPrefs: {
        reviewTodayNudges: false,
        weeklyReviewNudges: false,
      },
    });
    const seriesId = uuidv7();
    const occurrenceKey = new Date("2026-07-28T12:30:00.000Z");
    await env!.db.insert(activitySeries).values({
      id: seriesId,
      userId,
      tz: "UTC",
      dtstartLocal: occurrenceKey,
      title: "Synthetic task",
      durationMin: 30,
    });
    const compute = await computeNotificationJobs({
      db: env!.db,
      now: TICK_NOW,
    });
    expect(compute.created).toBeGreaterThan(0);

    const [created] = await env!.db
      .select()
      .from(notificationJobs)
      .where(eq(notificationJobs.userId, userId));
    expect(created?.state).toBe("pending");

    const send = vi.fn().mockResolvedValue(PROVIDER_ACCEPTED);
    const deliver = await deliverDueNotificationJobs({
      db: env!.db,
      now: new Date("2026-07-28T12:30:00.000Z"),
      send,
    });
    expect(deliver.delivered).toBe(1);
    expect(send).toHaveBeenCalledTimes(1);

    const [after] = await env!.db
      .select()
      .from(notificationJobs)
      .where(eq(notificationJobs.id, created!.id));
    expect(after?.state).toBe("sent");
    expect(after?.deliveredAt).not.toBeNull();
  });

  itDb("suppresses delivery when provider reports only stale 410 endpoints", async () => {
    const userId = uuidv7();
    await insertUser(env!.db, userId);
    await env!.db.insert(userSettings).values({
      userId,
      timezone: "UTC",
      notificationPrefs: {
        reviewTodayNudges: false,
        weeklyReviewNudges: false,
      },
    });
    const seriesId = uuidv7();
    const fireAt = new Date("2026-07-28T12:30:00.000Z");
    await env!.db.insert(activitySeries).values({
      id: seriesId,
      userId,
      tz: "UTC",
      dtstartLocal: fireAt,
      title: "Block",
      durationMin: 30,
    });
    await computeNotificationJobs({
      db: env!.db,
      now: TICK_NOW,
    });
    const send = vi.fn().mockResolvedValue({
      configured: true,
      subscriptions: 1,
      sent: 0,
      pruned: 1,
      retryableFailures: 0,
    } satisfies PushDeliveryResult);

    const summary = await deliverDueNotificationJobs({
      db: env!.db,
      now: fireAt,
      send,
    });
    expect(summary.pruned).toBeGreaterThanOrEqual(1);
    expect(summary.delivered).toBe(0);

    const jobs = await env!.db
      .select()
      .from(notificationJobs)
      .where(eq(notificationJobs.userId, userId));
    expect(jobs.some((job) => job.state === "suppressed")).toBe(true);
    expect(jobs.some((job) => job.lastError === "no-subscriptions")).toBe(true);
  });

  itDb("runs a full tick pipeline without duplicate routine series", async () => {
    const userId = uuidv7();
    await insertUser(env!.db, userId);
    await env!.db.insert(userSettings).values({
      userId,
      timezone: "UTC",
      notificationPrefs: {
        reviewTodayNudges: false,
        weeklyReviewNudges: false,
      },
    });
    const routineId = uuidv7();
    const scheduleId = uuidv7();
    await env!.db.insert(routines).values({
      id: routineId,
      userId,
      title: "Double tick routine",
    });
    await env!.db.insert(routineSteps).values({
      id: uuidv7(),
      userId,
      routineId,
      title: "Step",
      durationMin: 20,
      sortOrder: 0,
    });
    await env!.db.insert(routineSchedules).values({
      id: scheduleId,
      userId,
      routineId,
      tz: "UTC",
      rrule: "FREQ=DAILY",
      paused: false,
      nextRunAt: new Date(Date.now() - 60 * 60_000),
    });

    await env!.db.delete(schedulerRuns);
    const send = vi.fn().mockResolvedValue(PROVIDER_ACCEPTED);
    await runTickPipeline({ now: TICK_NOW, send });
    await runTickPipeline({
      now: new Date(TICK_NOW.getTime() + 60_000),
      send,
    });

    const series = await env!.db
      .select()
      .from(activitySeries)
      .where(
        and(
          eq(activitySeries.userId, userId),
          eq(activitySeries.source, "routine"),
        ),
      );
    const keys = series.map((row) => row.sourceRef);
    expect(new Set(keys).size).toBe(keys.length);

    const runs = await env!.db.select().from(schedulerRuns);
    expect(runs.filter((run) => run.state === "succeeded").length).toBe(2);
  });

  itDb("rejects a second row for the same dedup key at the database boundary", async () => {
    const userId = uuidv7();
    await insertUser(env!.db, userId);
    const dedupKey = `${userId}:dedup-collision-test`;
    const base = {
      userId,
      entityType: "review" as const,
      entityId: null,
      occurrenceKey: null,
      type: "review-today" as const,
      fireAt: new Date("2026-07-28T20:00:00.000Z"),
      expiresAt: new Date("2026-07-29T00:00:00.000Z"),
      dedupKey,
      nextAttemptAt: new Date("2026-07-28T20:00:00.000Z"),
      payload: { title: "Review today", body: "", tag: "review-today", url: "/app/review" },
    };
    await env!.db.insert(notificationJobs).values({
      id: uuidv7(),
      ...base,
      state: "pending",
    });
    await expect(
      env!.db.insert(notificationJobs).values({
        id: uuidv7(),
        ...base,
        state: "retry",
      }),
    ).rejects.toThrow();
  });
});
