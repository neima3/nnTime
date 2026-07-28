import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { eq, inArray } from "drizzle-orm";
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
  userSettings,
  type DbNotificationJob,
} from "../db/schema";
import type { PushDeliveryResult } from "./push";
import { deliverDueNotificationJobs } from "./notification-delivery";

const NOW = new Date("2026-07-28T23:00:00.000Z");
const OCCURRENCE = new Date("2026-07-28T22:30:00.000Z");
const SUCCESS: PushDeliveryResult = {
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
  it(name, async () => {
    if (!dbAvailable || !env) return;
    await fn();
  });

async function seedUser(prefs: Record<string, unknown> = {}) {
  if (!env) throw new Error("DB unavailable");
  const userId = uuidv7();
  await insertUser(env.db, userId);
  await env.db.insert(userSettings).values({
    userId,
    timezone: "UTC",
    notificationPrefs: prefs,
  });
  return userId;
}

async function seedSeries(userId: string) {
  if (!env) throw new Error("DB unavailable");
  const seriesId = uuidv7();
  await env.db.insert(activitySeries).values({
    id: seriesId,
    userId,
    tz: "UTC",
    dtstartLocal: OCCURRENCE,
    title: "Deep work",
    emoji: "🌿",
    durationMin: 30,
  });
  return seriesId;
}

async function seedJob(
  userId: string,
  input: Partial<typeof notificationJobs.$inferInsert> & {
    type?: DbNotificationJob["type"];
  } = {},
) {
  if (!env) throw new Error("DB unavailable");
  const type = input.type ?? "start";
  const isReview = type === "review-today" || type === "weekly-review";
  const seriesId =
    input.entityId ?? (isReview ? null : await seedSeries(userId));
  const id = input.id ?? uuidv7();
  await env.db.insert(notificationJobs).values({
    id,
    userId,
    entityType: isReview ? "review" : "activity",
    entityId: seriesId,
    occurrenceKey: isReview ? null : OCCURRENCE,
    type,
    fireAt: input.fireAt ?? new Date(NOW.getTime() - 60_000),
    expiresAt: input.expiresAt ?? new Date(NOW.getTime() + 30 * 60_000),
    dedupKey: input.dedupKey ?? `${userId}:${id}:${type}`,
    state: input.state ?? "pending",
    attempts: input.attempts ?? 0,
    nextAttemptAt: input.nextAttemptAt ?? new Date(NOW.getTime() - 60_000),
    claimedAt: input.claimedAt,
    payload:
      input.payload ??
      (isReview
        ? {
            title: type === "review-today" ? "Review today" : "Weekly review",
            body: "A gentle reflection.",
            tag: type,
            url: type === "review-today" ? "/app/review" : "/app/week",
          }
        : {
            title: "🌿 Deep work",
            body: "Starting now — no rush, just a nudge.",
            tag: `${type}-${seriesId}`,
            url: "/app/today",
          }),
  });
  return id;
}

async function getJob(id: string) {
  const [job] = await env!.db
    .select()
    .from(notificationJobs)
    .where(eq(notificationJobs.id, id));
  return job;
}

describe("deliverDueNotificationJobs", () => {
  itDb("atomically claims a due job once across concurrent workers", async () => {
    const userId = await seedUser();
    const jobId = await seedJob(userId);
    const send = vi.fn().mockResolvedValue(SUCCESS);

    const results = await Promise.all([
      deliverDueNotificationJobs({ db: env!.db, now: NOW, limit: 1, send }),
      deliverDueNotificationJobs({ db: env!.db, now: NOW, limit: 1, send }),
    ]);

    expect(send).toHaveBeenCalledTimes(1);
    expect(results.reduce((sum, result) => sum + result.considered, 0)).toBe(1);
    expect(await getJob(jobId)).toMatchObject({
      state: "sent",
      attempts: 1,
      claimedAt: null,
      deliveredAt: NOW,
    });
  });

  itDb("reclaims a processing job after the five-minute lease expires", async () => {
    const userId = await seedUser();
    const jobId = await seedJob(userId, {
      state: "processing",
      claimedAt: new Date(NOW.getTime() - 6 * 60_000),
    });
    const send = vi.fn().mockResolvedValue(SUCCESS);

    const result = await deliverDueNotificationJobs({
      db: env!.db,
      now: NOW,
      send,
    });

    expect(result).toMatchObject({ considered: 1, delivered: 1 });
    expect((await getJob(jobId)).state).toBe("sent");
  });

  itDb("suppresses disabled, quiet, missing, unconfigured, and unsubscribed jobs", async () => {
    const disabledUser = await seedUser({ startNudges: false });
    const quietUser = await seedUser({
      quietHours: { enabled: true, start: 22, end: 7 },
    });
    const missingUser = await seedUser();
    const unconfiguredUser = await seedUser();
    const unsubscribedUser = await seedUser();

    const disabledId = await seedJob(disabledUser);
    const quietId = await seedJob(quietUser);
    const missingId = await seedJob(missingUser, { entityId: uuidv7() });
    const unconfiguredId = await seedJob(unconfiguredUser);
    const unsubscribedId = await seedJob(unsubscribedUser);
    const send = vi.fn(async (userId: string) => {
      if (userId === unconfiguredUser) {
        return { ...SUCCESS, configured: false, subscriptions: 0, sent: 0 };
      }
      if (userId === unsubscribedUser) {
        return { ...SUCCESS, subscriptions: 0, sent: 0 };
      }
      return SUCCESS;
    });

    const result = await deliverDueNotificationJobs({
      db: env!.db,
      now: NOW,
      limit: 20,
      send,
    });

    expect(result.suppressed).toBeGreaterThanOrEqual(5);
    await expect(getJob(disabledId)).resolves.toMatchObject({
      state: "suppressed",
      lastError: "preference-disabled",
    });
    await expect(getJob(quietId)).resolves.toMatchObject({
      state: "suppressed",
      lastError: "quiet-hours",
    });
    await expect(getJob(missingId)).resolves.toMatchObject({
      state: "suppressed",
      lastError: "source-missing",
    });
    await expect(getJob(unconfiguredId)).resolves.toMatchObject({
      state: "suppressed",
      lastError: "push-unconfigured",
    });
    await expect(getJob(unsubscribedId)).resolves.toMatchObject({
      state: "suppressed",
      lastError: "no-subscriptions",
    });
  });

  itDb("retries transient failures with backoff and expires exhausted work", async () => {
    const userId = await seedUser();
    const retryId = await seedJob(userId);
    const exhaustedId = await seedJob(userId, {
      attempts: 4,
      dedupKey: `${userId}:exhausted`,
    });
    const send = vi.fn().mockResolvedValue({
      ...SUCCESS,
      sent: 0,
      retryableFailures: 1,
    });

    const first = await deliverDueNotificationJobs({
      db: env!.db,
      now: NOW,
      limit: 20,
      send,
    });
    const retry = await getJob(retryId);
    const exhausted = await getJob(exhaustedId);

    expect(first).toMatchObject({ retried: 1, expired: 1 });
    expect(retry).toMatchObject({
      state: "retry",
      attempts: 1,
      lastError: "transient-push-failure",
      claimedAt: null,
    });
    expect(retry.nextAttemptAt.toISOString()).toBe(
      "2026-07-28T23:01:00.000Z",
    );
    expect(exhausted).toMatchObject({
      state: "expired",
      attempts: 5,
      lastError: "retry-exhausted",
      claimedAt: null,
    });
  });

  itDb("expires work whose delivery window has passed without sending", async () => {
    const userId = await seedUser();
    const jobId = await seedJob(userId, {
      expiresAt: new Date(NOW.getTime() - 1),
    });
    const send = vi.fn().mockResolvedValue(SUCCESS);

    const result = await deliverDueNotificationJobs({
      db: env!.db,
      now: NOW,
      send,
    });

    expect(result.expired).toBeGreaterThanOrEqual(1);
    expect(send).not.toHaveBeenCalledWith(
      userId,
      expect.anything(),
      expect.anything(),
    );
    expect(await getJob(jobId)).toMatchObject({
      state: "expired",
      lastError: "delivery-window-expired",
      claimedAt: null,
    });
  });

  itDb("delivers all five notification types and leaves no abandoned claims", async () => {
    const userId = await seedUser();
    const ids = await Promise.all(
      (
        [
          "start",
          "halfway",
          "wrap-up",
          "review-today",
          "weekly-review",
        ] as const
      ).map((type) => seedJob(userId, { type, dedupKey: `${userId}:${type}` })),
    );
    const seenTags: string[] = [];
    const send = vi.fn(async (_userId: string, payload: { tag?: string }) => {
      seenTags.push(payload.tag ?? "");
      return SUCCESS;
    });

    await deliverDueNotificationJobs({
      db: env!.db,
      now: NOW,
      limit: 20,
      send,
    });
    const jobs = await env!.db
      .select()
      .from(notificationJobs)
      .where(inArray(notificationJobs.id, ids));

    expect(jobs.every((job) => job.state === "sent")).toBe(true);
    expect(jobs.every((job) => job.claimedAt === null)).toBe(true);
    expect(seenTags).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^start-/),
        expect.stringMatching(/^halfway-/),
        expect.stringMatching(/^wrap-up-/),
        "review-today",
        "weekly-review",
      ]),
    );
  });
});
