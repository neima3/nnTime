import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import {
  createEphemeralDb,
  insertUser,
  rethrowIfMigrationFailure,
  type EphemeralDb,
} from "./db/test-db";
import * as schema from "./db/schema";
import { withIdempotency } from "./idempotency";
import {
  createActivitySeries,
  createTask,
  type Db,
} from "./dal";

let env: EphemeralDb | null = null;
let dbAvailable = false;
let userId: string;

beforeAll(async () => {
  try {
    env = await createEphemeralDb();
    dbAvailable = true;
    userId = crypto.randomUUID();
    await insertUser(env.db, userId, "idempotency-concurrency@test.com");
  } catch (error) {
    rethrowIfMigrationFailure(error);
    dbAvailable = false;
  }
}, 60000);

afterAll(async () => {
  if (env) await env.teardown();
});

describe("withIdempotency concurrency", () => {
  it("does not cache a transient conflict that a fresh revision can resolve", async () => {
    if (!dbAvailable || !env) return;
    const key = crypto.randomUUID();
    let executions = 0;
    const execute = async () => {
      executions += 1;
      return executions === 1
        ? Response.json({ error: { code: "conflict" } }, { status: 409 })
        : Response.json({ revision: 8 }, { status: 200 });
    };

    const conflict = await withIdempotency(
      userId,
      key,
      "PATCH",
      "/api/v1/activities/activity-1",
      execute,
      { db: env.db as Db },
    );
    const retried = await withIdempotency(
      userId,
      key,
      "PATCH",
      "/api/v1/activities/activity-1",
      execute,
      { db: env.db as Db },
    );

    expect(conflict.status).toBe(409);
    expect(retried.status).toBe(200);
    expect(retried.headers.get("idempotent-replay")).toBeNull();
    expect(executions).toBe(2);
  });

  it("replays an empty 204 response without repeating the delete", async () => {
    if (!dbAvailable || !env) return;
    const key = crypto.randomUUID();
    let executions = 0;
    const execute = async () => {
      executions += 1;
      return new Response(null, { status: 204 });
    };

    const first = await withIdempotency(
      userId,
      key,
      "DELETE",
      "/api/v1/tasks/task-1",
      execute,
      { db: env.db as Db },
    );
    const replay = await withIdempotency(
      userId,
      key,
      "DELETE",
      "/api/v1/tasks/task-1",
      execute,
      { db: env.db as Db },
    );

    expect(first.status).toBe(204);
    expect(replay.status).toBe(204);
    expect(replay.headers.get("idempotent-replay")).toBe("true");
    expect(await replay.text()).toBe("");
    expect(executions).toBe(1);
  });

  it("rejects same-user key reuse for a different operation", async () => {
    if (!dbAvailable || !env) return;
    const key = crypto.randomUUID();
    let executions = 0;
    const execute = async () => {
      executions += 1;
      return Response.json({ ok: true }, { status: 200 });
    };

    await withIdempotency(
      userId,
      key,
      "PATCH",
      "/api/v1/settings",
      execute,
      { db: env.db as Db },
    );
    const reused = await withIdempotency(
      userId,
      key,
      "DELETE",
      "/api/v1/tasks/task-1",
      execute,
      { db: env.db as Db },
    );

    expect(reused.status).toBe(409);
    expect(await reused.json()).toEqual({
      error: {
        code: "idempotency_key_reused",
        message: "Idempotency-Key was already used for another operation",
        retryable: false,
        details: {
          originalMethod: "PATCH",
          originalPath: "/api/v1/settings",
        },
      },
    });
    expect(executions).toBe(1);
  });

  it("scopes identical keys independently by user", async () => {
    if (!dbAvailable || !env) return;
    const otherUserId = crypto.randomUUID();
    await insertUser(env.db, otherUserId, "idempotency-other@test.com");
    const key = crypto.randomUUID();
    let executions = 0;
    const execute = async () => {
      executions += 1;
      return Response.json({ execution: executions });
    };

    const first = await withIdempotency(
      userId,
      key,
      "PATCH",
      "/api/v1/settings",
      execute,
      { db: env.db as Db },
    );
    const other = await withIdempotency(
      otherUserId,
      key,
      "PATCH",
      "/api/v1/settings",
      execute,
      { db: env.db as Db },
    );

    expect(await first.json()).toEqual({ execution: 1 });
    expect(await other.json()).toEqual({ execution: 2 });
    expect(executions).toBe(2);
  });

  it("allows only one same-key mood side effect", async () => {
    if (!dbAvailable || !env) return;
    const key = crypto.randomUUID();
    let executions = 0;
    let releaseFirst!: () => void;
    let markFirstStarted!: () => void;
    const firstStarted = new Promise<void>((resolve) => {
      markFirstStarted = resolve;
    });
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });

    const execute = async (executionDb: Db) => {
      executions += 1;
      if (executions === 1) {
        markFirstStarted();
        await firstGate;
      }
      await executionDb.insert(schema.plannerEvents).values({
        id: crypto.randomUUID(),
        userId,
        entityType: "user",
        entityId: crypto.randomUUID(),
        eventType: "mood_checkin",
        payload: { mood: "good" },
        occurredAt: new Date(),
        tz: "America/New_York",
      });
      return Response.json({ ok: true }, { status: 201 });
    };

    const first = withIdempotency(
      userId,
      key,
      "POST",
      "/api/v1/mood",
      execute,
      { db: env.db as Db },
    );
    await firstStarted;
    const second = withIdempotency(
      userId,
      key,
      "POST",
      "/api/v1/mood",
      execute,
      { db: env.db as Db },
    );
    releaseFirst();
    const responses = await Promise.all([first, second]);

    const events = await env.db
      .select()
      .from(schema.plannerEvents)
      .where(
        and(
          eq(schema.plannerEvents.userId, userId),
          eq(schema.plannerEvents.eventType, "mood_checkin"),
        ),
      );
    expect(executions).toBe(1);
    expect(events).toHaveLength(1);
    expect(responses.map((response) => response.status)).toEqual([201, 201]);
    expect(
      responses.filter(
        (response) => response.headers.get("idempotent-replay") === "true",
      ),
    ).toHaveLength(1);
  });

  it("keeps task and activity mutations on the locked connection under pool saturation", async () => {
    if (!dbAvailable || !env) return;
    const client = postgres(env.url, { max: 2 });
    const boundedDb = drizzle(client, { schema });
    const timeout = new Promise<never>((_, reject) => {
      setTimeout(
        () => reject(new Error("idempotent mutations exhausted the bounded pool")),
        3000,
      );
    });

    try {
      const taskMutation = withIdempotency(
        userId,
        crypto.randomUUID(),
        "POST",
        "/api/v1/tasks",
        async (executionDb) => {
          const task = await createTask(
            userId,
            { bucket: "inbox", title: "Pool-safe task" },
            { db: executionDb },
          );
          return Response.json(task, { status: 201 });
        },
        { db: boundedDb as Db },
      );
      const activityMutation = withIdempotency(
        userId,
        crypto.randomUUID(),
        "POST",
        "/api/v1/activities",
        async (executionDb) => {
          const activity = await createActivitySeries(
            userId,
            {
              tz: "America/New_York",
              dtstartLocal: new Date("2026-07-28T09:00:00.000Z"),
              title: "Pool-safe activity",
              durationMin: 30,
            },
            { db: executionDb },
          );
          return Response.json(activity, { status: 201 });
        },
        { db: boundedDb as Db },
      );

      const responses = await Promise.race([
        Promise.all([taskMutation, activityMutation]),
        timeout,
      ]);
      expect(responses.map((response) => response.status)).toEqual([201, 201]);
    } finally {
      await client.end({ timeout: 1 });
    }
  });
});
