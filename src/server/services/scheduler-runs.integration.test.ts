import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, inArray } from "drizzle-orm";
import {
  createEphemeralDb,
  rethrowIfMigrationFailure,
  type EphemeralDb,
} from "../db/test-db";
import { schedulerRuns } from "../db/schema";
import {
  failSchedulerRun,
  getSchedulerHealth,
  pruneSchedulerRuns,
  startSchedulerRun,
  succeedSchedulerRun,
} from "./scheduler-runs";

const NOW = new Date("2026-07-28T23:00:00.000Z");

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

describe("scheduler run ledger", () => {
  itDb("records running and successful aggregate evidence", async () => {
    const id = await startSchedulerRun(env!.db, NOW);
    await expect(
      env!.db
        .select()
        .from(schedulerRuns)
        .where(eq(schedulerRuns.id, id)),
    ).resolves.toEqual([
      expect.objectContaining({
        id,
        state: "running",
        startedAt: NOW,
        finishedAt: null,
        summary: {},
        lastError: null,
      }),
    ]);

    const finishedAt = new Date(NOW.getTime() + 1_250);
    const summary = {
      materialized: 2,
      notificationsCreated: 5,
      delivered: 3,
    };
    await succeedSchedulerRun(env!.db, id, finishedAt, summary);
    const [run] = await env!.db
      .select()
      .from(schedulerRuns)
      .where(eq(schedulerRuns.id, id));

    expect(run).toMatchObject({
      state: "succeeded",
      startedAt: NOW,
      finishedAt,
      summary,
      lastError: null,
    });
  });

  itDb("records a sanitized bounded failure without payload details", async () => {
    const id = await startSchedulerRun(env!.db, NOW);
    const sensitive = `push failed\nhttps://push.invalid/secret ${"x".repeat(900)}`;
    await failSchedulerRun(env!.db, id, new Date(NOW.getTime() + 500), sensitive);
    const [run] = await env!.db
      .select()
      .from(schedulerRuns)
      .where(eq(schedulerRuns.id, id));

    expect(run.state).toBe("failed");
    expect(run.lastError).toHaveLength(500);
    expect(run.lastError).not.toContain("\n");
    expect(run.lastError).not.toContain("push.invalid");
    expect(run.summary).toEqual({});
  });

  itDb("prunes only completed runs older than the retention window", async () => {
    const oldSucceeded = await startSchedulerRun(
      env!.db,
      new Date("2026-06-01T00:00:00.000Z"),
    );
    await succeedSchedulerRun(
      env!.db,
      oldSucceeded,
      new Date("2026-06-01T00:01:00.000Z"),
      {},
    );
    const oldFailed = await startSchedulerRun(
      env!.db,
      new Date("2026-06-02T00:00:00.000Z"),
    );
    await failSchedulerRun(
      env!.db,
      oldFailed,
      new Date("2026-06-02T00:01:00.000Z"),
      "failed",
    );
    const oldRunning = await startSchedulerRun(
      env!.db,
      new Date("2026-06-03T00:00:00.000Z"),
    );
    const recent = await startSchedulerRun(
      env!.db,
      new Date("2026-07-28T22:55:00.000Z"),
    );
    await succeedSchedulerRun(env!.db, recent, NOW, {});

    await expect(pruneSchedulerRuns(env!.db, NOW, 30)).resolves.toBe(2);
    const remaining = await env!.db
      .select()
      .from(schedulerRuns)
      .where(
        inArray(schedulerRuns.id, [
          oldSucceeded,
          oldFailed,
          oldRunning,
          recent,
        ]),
      );

    expect(remaining.map((run) => run.id).sort()).toEqual(
      [oldRunning, recent].sort(),
    );
  });
});

describe("getSchedulerHealth", () => {
  itDb("reports unconfigured without reading run freshness", async () => {
    await expect(
      getSchedulerHealth({
        db: env!.db,
        now: NOW,
        configured: false,
        processStartedAt: new Date(NOW.getTime() - 60 * 60_000),
      }),
    ).resolves.toEqual({ state: "unconfigured", lagSeconds: null });
  });

  itDb("reports warming only during the bounded first-run grace period", async () => {
    await env!.db.delete(schedulerRuns);

    await expect(
      getSchedulerHealth({
        db: env!.db,
        now: NOW,
        configured: true,
        processStartedAt: new Date(NOW.getTime() - 4 * 60_000),
      }),
    ).resolves.toEqual({ state: "warming", lagSeconds: null });
    await expect(
      getSchedulerHealth({
        db: env!.db,
        now: NOW,
        configured: true,
        processStartedAt: new Date(NOW.getTime() - 6 * 60_000),
      }),
    ).resolves.toEqual({ state: "lagging", lagSeconds: null });
  });

  itDb("reports recent success and then lag as time advances", async () => {
    await env!.db.delete(schedulerRuns);
    const id = await startSchedulerRun(
      env!.db,
      new Date(NOW.getTime() - 2 * 60_000),
    );
    await succeedSchedulerRun(
      env!.db,
      id,
      new Date(NOW.getTime() - 90_000),
      {},
    );

    await expect(
      getSchedulerHealth({
        db: env!.db,
        now: NOW,
        configured: true,
        processStartedAt: new Date(NOW.getTime() - 60 * 60_000),
      }),
    ).resolves.toEqual({ state: "ok", lagSeconds: 90 });
    await expect(
      getSchedulerHealth({
        db: env!.db,
        now: new Date(NOW.getTime() + 10 * 60_000),
        configured: true,
        processStartedAt: new Date(NOW.getTime() - 60 * 60_000),
      }),
    ).resolves.toEqual({ state: "lagging", lagSeconds: 690 });
  });

  itDb("reports a newer failure and recovers after a later success", async () => {
    await env!.db.delete(schedulerRuns);
    const success = await startSchedulerRun(
      env!.db,
      new Date(NOW.getTime() - 4 * 60_000),
    );
    await succeedSchedulerRun(
      env!.db,
      success,
      new Date(NOW.getTime() - 3 * 60_000),
      {},
    );
    const failure = await startSchedulerRun(
      env!.db,
      new Date(NOW.getTime() - 2 * 60_000),
    );
    await failSchedulerRun(
      env!.db,
      failure,
      new Date(NOW.getTime() - 90_000),
      "failed",
    );

    await expect(
      getSchedulerHealth({
        db: env!.db,
        now: NOW,
        configured: true,
        processStartedAt: new Date(NOW.getTime() - 60 * 60_000),
      }),
    ).resolves.toEqual({ state: "failed", lagSeconds: 180 });

    const recovered = await startSchedulerRun(
      env!.db,
      new Date(NOW.getTime() - 60_000),
    );
    await succeedSchedulerRun(
      env!.db,
      recovered,
      new Date(NOW.getTime() - 30_000),
      {},
    );
    await expect(
      getSchedulerHealth({
        db: env!.db,
        now: NOW,
        configured: true,
        processStartedAt: new Date(NOW.getTime() - 60 * 60_000),
      }),
    ).resolves.toEqual({ state: "ok", lagSeconds: 30 });
  });
});
