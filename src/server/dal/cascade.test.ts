/**
 * Cascade + sync-integrity regressions (ADR-002 / ADR-004).
 *
 * Pins three bugs that shipped silently:
 *  1. Soft-deleting a routine tombstoned only the parent row, so its steps,
 *     schedules and already-materialized days stayed live on Today.
 *  2. Pausing a schedule left the days it had already materialized in place.
 *  3. Deleting an activity left a focus session running against it — ADR-004
 *     says the session auto-cancels, but focus_sessions.activity_occurrence_id
 *     is a bare uuid with no FK, so nothing did it.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import {
  createEphemeralDb,
  insertUser,
  rethrowIfMigrationFailure,
  type EphemeralDb,
} from "../db/test-db";
import * as schema from "../db/schema";
import {
  createRoutine,
  deleteRoutine,
  updateRoutineSchedule,
  createActivitySeries,
  deleteActivitySeries,
} from "./index";

let env: EphemeralDb | null = null;
let dbAvailable = false;
let userId = "user";

beforeAll(async () => {
  try {
    env = await createEphemeralDb();
    dbAvailable = true;
    userId = crypto.randomUUID();
    await insertUser(env.db, userId);
  } catch (e) {
    rethrowIfMigrationFailure(e);
    dbAvailable = false;
  }
}, 60000);

afterAll(async () => {
  if (env) await env.teardown();
}, 60000);

/** Skip (not pass) when Postgres is unavailable — honest CI signal. */
const itDb = (name: string, fn: (e: EphemeralDb) => Promise<void> | void) =>
  it(name, async ({ skip }) => {
    if (!dbAvailable || !env) {
      console.warn(`[SKIP] ${name}: Postgres unavailable`);
      skip(true, "Postgres unavailable");
      return;
    }
    await fn(env);
  });

/** Insert a series exactly as the routine materializer would. */
async function materializeDay(
  e: EphemeralDb,
  scheduleId: string,
  startAt: Date,
) {
  const id = crypto.randomUUID();
  await e.db.insert(schema.activitySeries).values({
    id,
    userId,
    tz: "America/New_York",
    dtstartLocal: startAt,
    rrule: null,
    title: "Morning reset",
    durationMin: 30,
    source: "routine",
    sourceRef: `${scheduleId}|${startAt.toISOString()}`,
  });
  return id;
}

async function isTombstoned(e: EphemeralDb, seriesId: string) {
  const [row] = await e.db
    .select({ deletedAt: schema.activitySeries.deletedAt })
    .from(schema.activitySeries)
    .where(eq(schema.activitySeries.id, seriesId))
    .limit(1);
  return row?.deletedAt != null;
}

const future = () => new Date(Date.now() + 24 * 60 * 60 * 1000);
const past = () => new Date(Date.now() - 24 * 60 * 60 * 1000);

describe("routine deletion cascades to children and materialized days", () => {
  itDb("tombstones steps, schedules and pending materialized series", async (e) => {
    const routine = await createRoutine(
      userId,
      {
        title: "Morning reset",
        steps: [{ title: "Water", durationMin: 5 }],
        schedule: { tz: "America/New_York", rrule: "FREQ=DAILY" },
      },
      { db: e.db },
    );
    const [sched] = await e.db
      .select()
      .from(schema.routineSchedules)
      .where(eq(schema.routineSchedules.routineId, routine.id));
    expect(sched).toBeDefined();

    const pendingDay = await materializeDay(e, sched!.id, future());
    const historicDay = await materializeDay(e, sched!.id, past());

    await deleteRoutine(userId, routine.id, routine.revision, { db: e.db });

    // Pending day is retired...
    expect(await isTombstoned(e, pendingDay)).toBe(true);
    // ...but history is preserved.
    expect(await isTombstoned(e, historicDay)).toBe(false);

    const [stepRow] = await e.db
      .select({ deletedAt: schema.routineSteps.deletedAt })
      .from(schema.routineSteps)
      .where(eq(schema.routineSteps.routineId, routine.id));
    expect(stepRow?.deletedAt).not.toBeNull();

    const [schedRow] = await e.db
      .select({ deletedAt: schema.routineSchedules.deletedAt })
      .from(schema.routineSchedules)
      .where(eq(schema.routineSchedules.id, sched!.id));
    expect(schedRow?.deletedAt).not.toBeNull();
  });

  itDb("pausing a schedule retires the days it already materialized", async (e) => {
    const routine = await createRoutine(
      userId,
      {
        title: "Evening wind-down",
        steps: [{ title: "Stretch", durationMin: 5 }],
        schedule: { tz: "America/New_York", rrule: "FREQ=DAILY" },
      },
      { db: e.db },
    );
    const [sched] = await e.db
      .select()
      .from(schema.routineSchedules)
      .where(eq(schema.routineSchedules.routineId, routine.id));

    const pendingDay = await materializeDay(e, sched!.id, future());

    await updateRoutineSchedule(
      userId,
      sched!.id,
      { paused: true },
      sched!.revision,
      { db: e.db },
    );

    expect(await isTombstoned(e, pendingDay)).toBe(true);
  });

  itDb("does not touch another schedule's materialized days", async (e) => {
    const keep = await createRoutine(
      userId,
      {
        title: "Keep me",
        steps: [{ title: "Read", durationMin: 5 }],
        schedule: { tz: "America/New_York", rrule: "FREQ=DAILY" },
      },
      { db: e.db },
    );
    const drop = await createRoutine(
      userId,
      {
        title: "Drop me",
        steps: [{ title: "Tidy", durationMin: 5 }],
        schedule: { tz: "America/New_York", rrule: "FREQ=DAILY" },
      },
      { db: e.db },
    );
    const [keepSched] = await e.db
      .select()
      .from(schema.routineSchedules)
      .where(eq(schema.routineSchedules.routineId, keep.id));
    const [dropSched] = await e.db
      .select()
      .from(schema.routineSchedules)
      .where(eq(schema.routineSchedules.routineId, drop.id));

    const keepDay = await materializeDay(e, keepSched!.id, future());
    const dropDay = await materializeDay(e, dropSched!.id, future());

    await deleteRoutine(userId, drop.id, drop.revision, { db: e.db });

    expect(await isTombstoned(e, dropDay)).toBe(true);
    expect(await isTombstoned(e, keepDay)).toBe(false);
  });
});

describe("ADR-004: deleting an activity cancels its focus session", () => {
  itDb("cancels a running session pointed at the deleted series", async (e) => {
    const series = await createActivitySeries(
      userId,
      {
        tz: "America/New_York",
        dtstartLocal: future(),
        rrule: null,
        title: "Deep work",
        durationMin: 50,
      },
      { db: e.db },
    );

    const occurrenceId = crypto.randomUUID();
    await e.db.insert(schema.activityOccurrences).values({
      id: occurrenceId,
      userId,
      seriesId: series.id,
      occurrenceKey: future(),
      status: "pending",
    });
    const sessionId = crypto.randomUUID();
    await e.db.insert(schema.focusSessions).values({
      id: sessionId,
      userId,
      activityOccurrenceId: occurrenceId,
      state: "running",
      targetDurationMin: 50,
      startedAt: new Date(),
    });

    await deleteActivitySeries(userId, series.id, series.revision, { db: e.db });

    const [session] = await e.db
      .select()
      .from(schema.focusSessions)
      .where(eq(schema.focusSessions.id, sessionId));
    expect(session?.state).toBe("cancelled");
    expect(session?.completionReason).toBe("activity_deleted");
  });

  itDb("leaves a session on an unrelated activity running", async (e) => {
    const doomed = await createActivitySeries(
      userId,
      {
        tz: "America/New_York",
        dtstartLocal: future(),
        rrule: null,
        title: "Doomed",
        durationMin: 25,
      },
      { db: e.db },
    );
    const other = await createActivitySeries(
      userId,
      {
        tz: "America/New_York",
        dtstartLocal: future(),
        rrule: null,
        title: "Untouched",
        durationMin: 25,
      },
      { db: e.db },
    );

    const otherOccurrence = crypto.randomUUID();
    await e.db.insert(schema.activityOccurrences).values({
      id: otherOccurrence,
      userId,
      seriesId: other.id,
      occurrenceKey: future(),
      status: "pending",
    });
    const sessionId = crypto.randomUUID();
    await e.db.insert(schema.focusSessions).values({
      id: sessionId,
      userId,
      activityOccurrenceId: otherOccurrence,
      state: "running",
      targetDurationMin: 25,
      startedAt: new Date(),
    });

    await deleteActivitySeries(userId, doomed.id, doomed.revision, { db: e.db });

    const [session] = await e.db
      .select()
      .from(schema.focusSessions)
      .where(
        and(
          eq(schema.focusSessions.id, sessionId),
          eq(schema.focusSessions.userId, userId),
        ),
      );
    expect(session?.state).toBe("running");
  });
});
