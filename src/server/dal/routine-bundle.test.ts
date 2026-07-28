import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, asc, eq } from "drizzle-orm";
import {
  createEphemeralDb,
  insertUser,
  rethrowIfMigrationFailure,
  type EphemeralDb,
} from "../db/test-db";
import * as schema from "../db/schema";
import { createRoutine } from "./index";

let env: EphemeralDb | null = null;
let dbAvailable = false;
let userId = "routine-bundle-user";

beforeAll(async () => {
  try {
    env = await createEphemeralDb();
    dbAvailable = true;
    userId = crypto.randomUUID();
    await insertUser(env.db, userId, "routine-bundle@test.com");
  } catch (error) {
    rethrowIfMigrationFailure(error);
    dbAvailable = false;
  }
}, 60_000);

afterAll(async () => {
  if (env) await env.teardown();
}, 60_000);

const itDb = (name: string, fn: () => Promise<void> | void) =>
  it(name, async ({ skip }) => {
    if (!dbAvailable || !env) {
      console.warn(`[SKIP] ${name}: Postgres unavailable`);
      skip(true, "Postgres unavailable");
      return;
    }
    await fn();
  });

async function userRowCounts() {
  const [routines, steps, schedules, changes] = await Promise.all([
    env!.db
      .select()
      .from(schema.routines)
      .where(eq(schema.routines.userId, userId)),
    env!.db
      .select()
      .from(schema.routineSteps)
      .where(eq(schema.routineSteps.userId, userId)),
    env!.db
      .select()
      .from(schema.routineSchedules)
      .where(eq(schema.routineSchedules.userId, userId)),
    env!.db
      .select()
      .from(schema.changeLog)
      .where(eq(schema.changeLog.userId, userId)),
  ]);
  return {
    routines: routines.length,
    steps: steps.length,
    schedules: schedules.length,
    changes: changes.length,
  };
}

describe("createRoutine atomic bundle", () => {
  itDb("commits routine, ordered steps, schedule, and both change entries", async () => {
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
      { db: env!.db },
    );

    const steps = await env!.db
      .select()
      .from(schema.routineSteps)
      .where(
        and(
          eq(schema.routineSteps.userId, userId),
          eq(schema.routineSteps.routineId, routine.id),
        ),
      )
      .orderBy(asc(schema.routineSteps.sortOrder));
    const schedules = await env!.db
      .select()
      .from(schema.routineSchedules)
      .where(
        and(
          eq(schema.routineSchedules.userId, userId),
          eq(schema.routineSchedules.routineId, routine.id),
        ),
      );
    const changes = await env!.db
      .select()
      .from(schema.changeLog)
      .where(eq(schema.changeLog.userId, userId))
      .orderBy(asc(schema.changeLog.id));

    expect(steps.map((step) => [step.title, step.sortOrder])).toEqual([
      ["Stretch", 0],
      ["Plan", 1],
    ]);
    expect(schedules).toHaveLength(1);
    expect(schedules[0]).toMatchObject({
      routineId: routine.id,
      tz: "America/New_York",
      rrule: "FREQ=DAILY",
      paused: false,
    });
    expect(
      changes.map((entry) => [entry.entityType, entry.entityId]),
    ).toEqual([
      ["routines", routine.id],
      ["routine_schedules", schedules[0]!.id],
    ]);
  });

  itDb("rolls back every row when schedule insertion fails", async () => {
    const before = await userRowCounts();
    const invalidSchedule = {
      tz: null,
      rrule: "FREQ=DAILY",
      paused: false,
    } as unknown as {
      tz: string;
      rrule?: string | null;
      paused?: boolean;
    };

    await expect(
      createRoutine(
        userId,
        {
          title: "Must roll back",
          steps: [{ title: "Never persists", durationMin: 1 }],
          schedule: invalidSchedule,
        },
        { db: env!.db },
      ),
    ).rejects.toThrow();

    expect(await userRowCounts()).toEqual(before);
  });
});
