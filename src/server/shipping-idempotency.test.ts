import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import {
  createEphemeralDb,
  insertUser,
  rethrowIfMigrationFailure,
  type EphemeralDb,
} from "./db/test-db";
import * as schema from "./db/schema";
import {
  appendPlannerEvent,
  createActivitySeries,
  createRoutine,
  createTask,
  deleteActivitySeries,
  deleteTask,
  getOrCreateSettings,
  listRoutineSchedules,
  listRoutineSteps,
  listRoutines,
  updateSettings,
  type Db,
} from "./dal";
import { withIdempotency } from "./idempotency";
import {
  startFocusSession,
  transitionFocusSession,
} from "./services/focus";

let env: EphemeralDb | null = null;
let dbAvailable = false;

beforeAll(async () => {
  try {
    env = await createEphemeralDb();
    dbAvailable = true;
  } catch (error) {
    rethrowIfMigrationFailure(error);
    dbAvailable = false;
  }
}, 60_000);

afterAll(async () => {
  if (env) await env.teardown();
}, 60_000);

const itDb = (name: string, run: () => Promise<void>) =>
  it(name, async ({ skip }) => {
    if (!dbAvailable || !env) {
      skip(true, "Postgres unavailable");
      return;
    }
    await run();
  });

async function user(label: string): Promise<string> {
  const userId = crypto.randomUUID();
  await insertUser(env!.db, userId, `${label}-${userId}@test.com`);
  return userId;
}

describe("shipping native mutation idempotency", () => {
  itDb("replays routine creation without duplicating its steps or schedule", async () => {
    const userId = await user("routine-create-idempotency");
    const key = crypto.randomUUID();
    let executions = 0;
    const execute = async (db: Db) => {
      executions += 1;
      const routine = await createRoutine(
        userId,
        {
          title: "Morning reset",
          steps: [
            { title: "Stretch", durationMin: 5 },
            { title: "Plan", durationMin: 10 },
          ],
          schedule: {
            tz: "America/New_York",
            rrule: "FREQ=DAILY",
            paused: false,
          },
        },
        { db },
      );
      return Response.json(routine, { status: 201 });
    };

    const first = await withIdempotency(
      userId,
      key,
      "POST",
      "/api/v1/routines",
      execute,
      { db: env!.db as Db },
    );
    const replay = await withIdempotency(
      userId,
      key,
      "POST",
      "/api/v1/routines",
      execute,
      { db: env!.db as Db },
    );
    const routines = await listRoutines(userId, { db: env!.db });
    const steps = await listRoutineSteps(userId, routines[0]!.id, {
      db: env!.db,
    });
    const schedules = await listRoutineSchedules(userId, routines[0]!.id, {
      db: env!.db,
    });

    expect(first.status).toBe(201);
    expect(replay.status).toBe(201);
    expect(replay.headers.get("idempotent-replay")).toBe("true");
    expect(executions).toBe(1);
    expect(routines).toHaveLength(1);
    expect(steps).toHaveLength(2);
    expect(schedules).toHaveLength(1);
  });

  itDb("replays settings PATCH without a second revision bump", async () => {
    const userId = await user("settings-idempotency");
    const settings = await getOrCreateSettings(userId, { db: env!.db });
    const key = crypto.randomUUID();
    let executions = 0;
    const execute = async (db: Db) => {
      executions += 1;
      const updated = await updateSettings(
        userId,
        { theme: "dark" },
        settings.revision,
        { db },
      );
      return Response.json(updated);
    };

    const first = await withIdempotency(
      userId,
      key,
      "PATCH",
      "/api/v1/settings",
      execute,
      { db: env!.db as Db },
    );
    const replay = await withIdempotency(
      userId,
      key,
      "PATCH",
      "/api/v1/settings",
      execute,
      { db: env!.db as Db },
    );

    expect(await first.json()).toMatchObject({ revision: 2, theme: "dark" });
    expect(await replay.json()).toMatchObject({ revision: 2, theme: "dark" });
    expect(replay.headers.get("idempotent-replay")).toBe("true");
    expect(executions).toBe(1);
    expect(
      (await getOrCreateSettings(userId, { db: env!.db })).revision,
    ).toBe(2);
  });

  itDb("replays activity DELETE without a second tombstone", async () => {
    const userId = await user("activity-delete-idempotency");
    const activity = await createActivitySeries(
      userId,
      {
        tz: "UTC",
        dtstartLocal: new Date("2026-07-28T12:00:00.000Z"),
        title: "Delete once",
        durationMin: 25,
      },
      { db: env!.db },
    );
    const key = crypto.randomUUID();
    let executions = 0;
    const execute = async (db: Db) => {
      executions += 1;
      await deleteActivitySeries(
        userId,
        activity.id,
        activity.revision,
        { db },
      );
      return new Response(null, { status: 204 });
    };

    const first = await withIdempotency(
      userId,
      key,
      "DELETE",
      `/api/v1/activities/${activity.id}`,
      execute,
      { db: env!.db as Db },
    );
    const replay = await withIdempotency(
      userId,
      key,
      "DELETE",
      `/api/v1/activities/${activity.id}`,
      execute,
      { db: env!.db as Db },
    );
    const [stored] = await env!.db
      .select()
      .from(schema.activitySeries)
      .where(eq(schema.activitySeries.id, activity.id));

    expect([first.status, replay.status]).toEqual([204, 204]);
    expect(replay.headers.get("idempotent-replay")).toBe("true");
    expect(executions).toBe(1);
    expect(stored).toMatchObject({ revision: 2 });
    expect(stored?.deletedAt).toBeInstanceOf(Date);
  });

  itDb("replays task DELETE without a second tombstone", async () => {
    const userId = await user("task-delete-idempotency");
    const task = await createTask(
      userId,
      { bucket: "inbox", title: "Delete once" },
      { db: env!.db },
    );
    const key = crypto.randomUUID();
    let executions = 0;
    const execute = async (db: Db) => {
      executions += 1;
      await deleteTask(userId, task.id, task.revision, { db });
      return new Response(null, { status: 204 });
    };

    const first = await withIdempotency(
      userId,
      key,
      "DELETE",
      `/api/v1/tasks/${task.id}`,
      execute,
      { db: env!.db as Db },
    );
    const replay = await withIdempotency(
      userId,
      key,
      "DELETE",
      `/api/v1/tasks/${task.id}`,
      execute,
      { db: env!.db as Db },
    );
    const [stored] = await env!.db
      .select()
      .from(schema.tasks)
      .where(eq(schema.tasks.id, task.id));

    expect([first.status, replay.status]).toEqual([204, 204]);
    expect(replay.headers.get("idempotent-replay")).toBe("true");
    expect(executions).toBe(1);
    expect(stored).toMatchObject({ revision: 2 });
    expect(stored?.deletedAt).toBeInstanceOf(Date);
  });

  itDb("replays focus POST without a second session or start event", async () => {
    const userId = await user("focus-start-idempotency");
    const key = crypto.randomUUID();
    let executions = 0;
    const execute = async (db: Db) => {
      executions += 1;
      const session = await startFocusSession(
        userId,
        { targetDurationMin: 25 },
        { db },
      );
      await appendPlannerEvent(
        userId,
        {
          entityType: "focus_session",
          entityId: session.id,
          eventType: "focus_start",
          payload: { targetDurationMin: 25 },
        },
        { db },
      );
      return Response.json(session, { status: 201 });
    };

    const first = await withIdempotency(
      userId,
      key,
      "POST",
      "/api/v1/focus-sessions",
      execute,
      { db: env!.db as Db },
    );
    const replay = await withIdempotency(
      userId,
      key,
      "POST",
      "/api/v1/focus-sessions",
      execute,
      { db: env!.db as Db },
    );
    const sessions = await env!.db
      .select()
      .from(schema.focusSessions)
      .where(eq(schema.focusSessions.userId, userId));
    const starts = await env!.db
      .select()
      .from(schema.plannerEvents)
      .where(
        and(
          eq(schema.plannerEvents.userId, userId),
          eq(schema.plannerEvents.eventType, "focus_start"),
        ),
      );

    expect((await first.json()).id).toBe((await replay.json()).id);
    expect(replay.headers.get("idempotent-replay")).toBe("true");
    expect(executions).toBe(1);
    expect(sessions).toHaveLength(1);
    expect(starts).toHaveLength(1);
  });

  itDb("replays focus PATCH without a second transition or stop event", async () => {
    const userId = await user("focus-patch-idempotency");
    const session = await startFocusSession(
      userId,
      { targetDurationMin: 25 },
      { db: env!.db },
    );
    const key = crypto.randomUUID();
    let executions = 0;
    const execute = async (db: Db) => {
      executions += 1;
      const completed = await transitionFocusSession(
        userId,
        session.id,
        "completed",
        session.revision,
        { db },
      );
      await appendPlannerEvent(
        userId,
        {
          entityType: "focus_session",
          entityId: session.id,
          eventType: "focus_stop",
          payload: { state: "completed" },
        },
        { db },
      );
      return Response.json(completed);
    };

    const first = await withIdempotency(
      userId,
      key,
      "PATCH",
      `/api/v1/focus-sessions/${session.id}`,
      execute,
      { db: env!.db as Db },
    );
    const replay = await withIdempotency(
      userId,
      key,
      "PATCH",
      `/api/v1/focus-sessions/${session.id}`,
      execute,
      { db: env!.db as Db },
    );
    const [stored] = await env!.db
      .select()
      .from(schema.focusSessions)
      .where(eq(schema.focusSessions.id, session.id));
    const stops = await env!.db
      .select()
      .from(schema.plannerEvents)
      .where(
        and(
          eq(schema.plannerEvents.userId, userId),
          eq(schema.plannerEvents.eventType, "focus_stop"),
        ),
      );

    expect(await first.json()).toMatchObject({
      state: "completed",
      revision: 2,
    });
    expect(await replay.json()).toMatchObject({
      state: "completed",
      revision: 2,
    });
    expect(replay.headers.get("idempotent-replay")).toBe("true");
    expect(executions).toBe(1);
    expect(stored).toMatchObject({ state: "completed", revision: 2 });
    expect(stops).toHaveLength(1);
  });
});
