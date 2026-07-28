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
