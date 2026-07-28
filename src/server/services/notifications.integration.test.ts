import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";
import {
  createEphemeralDb,
  insertUser,
  rethrowIfMigrationFailure,
  type EphemeralDb,
} from "../db/test-db";
import {
  activityOccurrences,
  activitySeries,
  changeLog,
  notificationJobs,
  plannerEvents,
  pushSubscriptions,
  userSettings,
} from "../db/schema";
import {
  computeNotificationJobs,
  registerPushSubscription,
} from "./notifications";

const NOW = new Date("2026-07-28T12:00:00.000Z");
const NO_REVIEWS = {
  reviewTodayNudges: false,
  weeklyReviewNudges: false,
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
  it(name, async () => {
    if (!dbAvailable || !env) return;
    await fn();
  });

async function seedUser(
  prefs: Record<string, unknown> = NO_REVIEWS,
  options: { timezone?: string; weekStart?: number } = {},
) {
  if (!env) throw new Error("DB unavailable");
  const userId = uuidv7();
  await insertUser(env.db, userId);
  await env.db.insert(userSettings).values({
    userId,
    timezone: options.timezone ?? "UTC",
    weekStart: options.weekStart ?? 0,
    notificationPrefs: prefs,
  });
  return userId;
}

async function seedSeries(
  userId: string,
  input: {
    start: Date;
    durationMin?: number;
    rrule?: string | null;
    title?: string;
  },
) {
  if (!env) throw new Error("DB unavailable");
  const id = uuidv7();
  await env.db.insert(activitySeries).values({
    id,
    userId,
    tz: "UTC",
    dtstartLocal: input.start,
    rrule: input.rrule ?? null,
    title: input.title ?? "Deep work",
    emoji: "🌿",
    durationMin: input.durationMin ?? 30,
  });
  return id;
}

describe("computeNotificationJobs", () => {
  itDb("deduplicates consecutive computes and never writes planner history", async () => {
    const userId = await seedUser();
    const seriesId = await seedSeries(userId, {
      start: new Date("2026-07-28T13:00:00.000Z"),
    });

    const first = await computeNotificationJobs({ db: env!.db, now: NOW });
    const second = await computeNotificationJobs({ db: env!.db, now: NOW });
    const jobs = await env!.db
      .select()
      .from(notificationJobs)
      .where(eq(notificationJobs.userId, userId));

    expect(first).toMatchObject({ desired: 3, created: 3, cancelled: 0 });
    expect(second).toMatchObject({ desired: 3, created: 0, cancelled: 0 });
    expect(jobs.map((job) => job.type).sort()).toEqual([
      "halfway",
      "start",
      "wrap-up",
    ]);
    expect(jobs.every((job) => job.entityId === seriesId)).toBe(true);
    expect(await env!.db.select().from(plannerEvents)).toHaveLength(0);
    expect(await env!.db.select().from(changeLog)).toHaveLength(0);
  });

  itDb("applies reminder offsets and privacy before persisting jobs", async () => {
    const userId = await seedUser({
      ...NO_REVIEWS,
      startOffsetMin: -10,
      hideActivityTitlesOnLockScreen: true,
    });
    await seedSeries(userId, {
      start: new Date("2026-07-28T13:00:00.000Z"),
      title: "Private appointment",
    });

    await computeNotificationJobs({ db: env!.db, now: NOW });
    const jobs = await env!.db
      .select()
      .from(notificationJobs)
      .where(eq(notificationJobs.userId, userId));
    const start = jobs.find((job) => job.type === "start");

    expect(start?.fireAt.toISOString()).toBe(
      "2026-07-28T12:50:00.000Z",
    );
    expect(start?.payload).toMatchObject({ title: "Activity starting" });
    expect(JSON.stringify(start?.payload)).not.toContain(
      "Private appointment",
    );
  });

  itDb("expands recurring activity occurrences across the horizon", async () => {
    const userId = await seedUser();
    await seedSeries(userId, {
      start: new Date("2026-07-28T13:00:00.000Z"),
      rrule: "FREQ=DAILY",
    });

    await computeNotificationJobs({
      db: env!.db,
      now: NOW,
      horizonHours: 50,
    });
    const jobs = await env!.db
      .select()
      .from(notificationJobs)
      .where(eq(notificationJobs.userId, userId));
    const occurrenceKeys = new Set(
      jobs.map((job) => job.occurrenceKey?.toISOString()),
    );

    expect(jobs).toHaveLength(9);
    expect(occurrenceKeys).toEqual(
      new Set([
        "2026-07-28T13:00:00.000Z",
        "2026-07-29T13:00:00.000Z",
        "2026-07-30T13:00:00.000Z",
      ]),
    );
  });

  itDb("uses override timing while retaining the stable occurrence key", async () => {
    const userId = await seedUser();
    const occurrenceKey = new Date("2026-07-28T14:00:00.000Z");
    const seriesId = await seedSeries(userId, {
      start: occurrenceKey,
      durationMin: 30,
    });
    await env!.db.insert(activityOccurrences).values({
      id: uuidv7(),
      userId,
      seriesId,
      occurrenceKey,
      startAt: new Date("2026-07-28T15:00:00.000Z"),
      durationMin: 20,
      status: "pending",
    });

    await computeNotificationJobs({ db: env!.db, now: NOW });
    const jobs = await env!.db
      .select()
      .from(notificationJobs)
      .where(eq(notificationJobs.userId, userId));

    expect(jobs.map((job) => job.fireAt.toISOString()).sort()).toEqual([
      "2026-07-28T15:00:00.000Z",
      "2026-07-28T15:10:00.000Z",
      "2026-07-28T15:15:00.000Z",
    ]);
    expect(
      jobs.every(
        (job) =>
          job.occurrenceKey?.toISOString() === occurrenceKey.toISOString() &&
          job.dedupKey.includes(occurrenceKey.toISOString()),
      ),
    ).toBe(true);
  });

  itDb("schedules an occurrence moved into the horizon from outside it", async () => {
    const userId = await seedUser();
    const occurrenceKey = new Date("2026-07-30T14:00:00.000Z");
    const seriesId = await seedSeries(userId, {
      start: occurrenceKey,
      durationMin: 30,
    });
    await env!.db.insert(activityOccurrences).values({
      id: uuidv7(),
      userId,
      seriesId,
      occurrenceKey,
      startAt: new Date("2026-07-28T15:00:00.000Z"),
      durationMin: 20,
      status: "pending",
    });

    await computeNotificationJobs({ db: env!.db, now: NOW });
    const jobs = await env!.db
      .select()
      .from(notificationJobs)
      .where(eq(notificationJobs.userId, userId));

    expect(jobs.map((job) => job.fireAt.toISOString()).sort()).toEqual([
      "2026-07-28T15:00:00.000Z",
      "2026-07-28T15:10:00.000Z",
      "2026-07-28T15:15:00.000Z",
    ]);
    expect(
      jobs.every(
        (job) =>
          job.entityId === seriesId &&
          job.occurrenceKey?.toISOString() === occurrenceKey.toISOString(),
      ),
    ).toBe(true);
  });

  itDb("does not schedule completed, skipped, or cancelled occurrences", async () => {
    const userId = await seedUser();
    const statuses = ["completed", "skipped", "cancelled"] as const;
    for (let index = 0; index < statuses.length; index++) {
      const occurrenceKey = new Date(NOW.getTime() + (index + 1) * 60 * 60_000);
      const seriesId = await seedSeries(userId, { start: occurrenceKey });
      await env!.db.insert(activityOccurrences).values({
        id: uuidv7(),
        userId,
        seriesId,
        occurrenceKey,
        status: statuses[index],
      });
    }

    await computeNotificationJobs({ db: env!.db, now: NOW });
    const jobs = await env!.db
      .select()
      .from(notificationJobs)
      .where(eq(notificationJobs.userId, userId));

    expect(jobs).toHaveLength(0);
  });

  itDb("cancels future jobs when preferences or source state change", async () => {
    const userId = await seedUser();
    const seriesId = await seedSeries(userId, {
      start: new Date("2026-07-28T16:00:00.000Z"),
    });
    await computeNotificationJobs({ db: env!.db, now: NOW });

    await env!.db
      .update(userSettings)
      .set({
        notificationPrefs: {
          ...NO_REVIEWS,
          startNudges: false,
        },
      })
      .where(eq(userSettings.userId, userId));
    await computeNotificationJobs({ db: env!.db, now: NOW });

    const afterPreference = await env!.db
      .select()
      .from(notificationJobs)
      .where(eq(notificationJobs.userId, userId));
    expect(
      afterPreference.find((job) => job.type === "start")?.state,
    ).toBe("cancelled");
    expect(
      afterPreference
        .filter((job) => job.type !== "start")
        .every((job) => job.state === "pending"),
    ).toBe(true);

    await env!.db
      .update(activitySeries)
      .set({ deletedAt: NOW })
      .where(
        and(
          eq(activitySeries.userId, userId),
          eq(activitySeries.id, seriesId),
        ),
      );
    await computeNotificationJobs({ db: env!.db, now: NOW });
    const finalJobs = await env!.db
      .select()
      .from(notificationJobs)
      .where(eq(notificationJobs.userId, userId));
    expect(finalJobs.every((job) => job.state === "cancelled")).toBe(true);
  });

  itDb("creates daily and week-ending review jobs in the planning zone", async () => {
    const userId = await seedUser(
      {
        startNudges: false,
        halfwayNudges: false,
        wrapUpNudges: false,
      },
      { timezone: "UTC", weekStart: 3 },
    );

    await computeNotificationJobs({
      db: env!.db,
      now: new Date("2026-07-28T17:30:00.000Z"),
    });
    const jobs = await env!.db
      .select()
      .from(notificationJobs)
      .where(eq(notificationJobs.userId, userId));

    expect(
      jobs.map((job) => [job.type, job.fireAt.toISOString()]).sort(),
    ).toEqual([
      ["review-today", "2026-07-28T20:00:00.000Z"],
      ["weekly-review", "2026-07-28T18:00:00.000Z"],
    ]);
  });

  itDb("prevents duplicates under concurrent computes", async () => {
    const userId = await seedUser();
    await seedSeries(userId, {
      start: new Date("2026-07-28T14:00:00.000Z"),
    });

    await Promise.all([
      computeNotificationJobs({ db: env!.db, now: NOW }),
      computeNotificationJobs({ db: env!.db, now: NOW }),
    ]);
    const jobs = await env!.db
      .select()
      .from(notificationJobs)
      .where(
        and(
          eq(notificationJobs.userId, userId),
          inArray(notificationJobs.type, ["start", "halfway", "wrap-up"]),
        ),
      );

    expect(jobs).toHaveLength(3);
    expect(new Set(jobs.map((job) => job.dedupKey)).size).toBe(3);
  });
});

describe("push subscription registration", () => {
  itDb("caps each account at ten live subscriptions", async () => {
    const userId = await seedUser();

    for (let index = 0; index < 12; index++) {
      await registerPushSubscription(
        userId,
        {
          endpoint: `https://push.invalid/${index}`,
          keys: { p256dh: `key-${index}`, auth: `auth-${index}` },
        },
        { db: env!.db },
      );
    }

    const live = await env!.db
      .select()
      .from(pushSubscriptions)
      .where(
        and(
          eq(pushSubscriptions.userId, userId),
          isNull(pushSubscriptions.deletedAt),
        ),
    );
    expect(live).toHaveLength(10);
    expect(live.map((subscription) => subscription.endpoint)).toContain(
      "https://push.invalid/11",
    );
  });
});
