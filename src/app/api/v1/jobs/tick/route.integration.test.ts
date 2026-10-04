/**
 * Task 5.2 — authenticated tick against ephemeral Postgres (synthetic only).
 */
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { eq } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";
import type { Db } from "@/server/dal";
import {
  createEphemeralDb,
  insertUser,
  rethrowIfMigrationFailure,
  type EphemeralDb,
} from "@/server/db/test-db";
import {
  activitySeries,
  notificationJobs,
  schedulerRuns,
  userSettings,
} from "@/server/db/schema";
import { computeNotificationJobs } from "@/server/services/notifications";
import type { PushDeliveryResult } from "@/server/services/push";

const dbHolder = vi.hoisted(() => ({ db: null as Db | null }));

vi.mock("@/server/db", () => ({
  default: new Proxy({} as Db, {
    get(_target, prop, receiver) {
      const db = dbHolder.db;
      if (!db) {
        throw new Error("ephemeral db not initialized");
      }
      return Reflect.get(db, prop, receiver);
    },
  }),
}));

const pushOutcome = vi.hoisted(() => ({
  result: {
    configured: true,
    subscriptions: 0,
    sent: 0,
    pruned: 0,
    retryableFailures: 0,
  } satisfies PushDeliveryResult,
}));

vi.mock("@/server/services/push", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/services/push")>();
  return {
    ...actual,
    sendToUser: vi.fn(async () => pushOutcome.result),
  };
});

import { POST } from "./route";

const URL = "http://127.0.0.1:3000/api/v1/jobs/tick";
let env: EphemeralDb | null = null;
let dbAvailable = false;

beforeAll(async () => {
  try {
    env = await createEphemeralDb();
    dbHolder.db = env.db;
    dbAvailable = true;
  } catch (error) {
    rethrowIfMigrationFailure(error);
  }
}, 60_000);

afterAll(async () => {
  await env?.teardown();
  dbHolder.db = null;
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

describe("POST /api/v1/jobs/tick integration", () => {
  beforeEach(() => {
    vi.stubEnv("CRON_SECRET", "integration-cron-secret");
    vi.stubEnv("NODE_ENV", "test");
    pushOutcome.result = {
      configured: true,
      subscriptions: 0,
      sent: 0,
      pruned: 0,
      retryableFailures: 0,
    };
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  itDb("records succeeded scheduler runs for consecutive ticks", async () => {
    await env!.db.delete(schedulerRuns);
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

    const first = await POST(
      new Request(URL, {
        method: "POST",
        headers: { authorization: "Bearer integration-cron-secret" },
      }),
    );
    const second = await POST(
      new Request(URL, {
        method: "POST",
        headers: { authorization: "Bearer integration-cron-secret" },
      }),
    );

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    const runs = await env!.db.select().from(schedulerRuns);
    expect(runs.filter((run) => run.state === "succeeded").length).toBe(2);
  });

  itDb("survives overlapping concurrent ticks without duplicate scheduler corruption", async () => {
    await env!.db.delete(schedulerRuns);
    const responses = await Promise.all(
      Array.from({ length: 2 }, () =>
        POST(
          new Request(URL, {
            method: "POST",
            headers: { authorization: "Bearer integration-cron-secret" },
          }),
        ),
      ),
    );
    expect(responses.every((response) => response.status === 200)).toBe(true);
    const runs = await env!.db.select().from(schedulerRuns);
    expect(runs.length).toBe(2);
    expect(runs.every((run) => run.state === "succeeded")).toBe(true);
  });

  itDb("records failure when delivery throws (restart recovery path)", async () => {
    await env!.db.delete(schedulerRuns);
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
    const fireAt = new Date(Date.now() - 5 * 60_000);
    await env!.db.insert(activitySeries).values({
      id: seriesId,
      userId,
      tz: "UTC",
      dtstartLocal: fireAt,
      title: "Due block",
      durationMin: 30,
    });
    await computeNotificationJobs({
      db: env!.db,
      now: new Date(fireAt.getTime() - 60 * 60_000),
    });
    const dueJobs = await env!.db
      .select()
      .from(notificationJobs)
      .where(eq(notificationJobs.userId, userId));
    expect(dueJobs.length).toBeGreaterThan(0);

    const { sendToUser } = await import("@/server/services/push");
    vi.mocked(sendToUser).mockRejectedValueOnce(new Error("synthetic crash"));

    const response = await POST(
      new Request(URL, {
        method: "POST",
        headers: { authorization: "Bearer integration-cron-secret" },
      }),
    );
    expect(response.status).toBe(500);

    const [failed] = await env!.db
      .select()
      .from(schedulerRuns)
      .where(eq(schedulerRuns.state, "failed"));
    expect(failed?.lastError).toContain("synthetic crash");

    vi.mocked(sendToUser).mockResolvedValue(pushOutcome.result);
    const recovery = await POST(
      new Request(URL, {
        method: "POST",
        headers: { authorization: "Bearer integration-cron-secret" },
      }),
    );
    expect(recovery.status).toBe(200);
  });
});
