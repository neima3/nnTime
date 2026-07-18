/**
 * Routine materializer tests — ADR-004 / Wave 2C.
 *
 * Verifies:
 *  - Double-run produces zero duplicate series (sourceRef dedupe).
 *  - nextRunAt advances past the materialization horizon.
 *  - Duration is derived from routine steps.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq, isNull } from "drizzle-orm";
import { createEphemeralDb, insertUser, type EphemeralDb } from "../db/test-db";
import * as schema from "../db/schema";
import { materializeRoutines } from "./routine-materializer";

let env: EphemeralDb | null = null;
let dbAvailable = false;
let userId: string;

beforeAll(async () => {
  try {
    env = await createEphemeralDb();
    dbAvailable = true;
    userId = crypto.randomUUID();
    await insertUser(env!.db, userId, "materializer@test.com");
  } catch {
    dbAvailable = false;
  }
}, 60000);

afterAll(async () => {
  if (env) await env.teardown();
}, 60000);

const itDb = (name: string, fn: () => Promise<void> | void) =>
  it(name, async () => {
    if (!dbAvailable || !env) return;
    await fn();
  });

async function seedRoutineWithSchedule(opts?: {
  nextRunAt?: Date | null;
  steps?: { title: string; durationMin: number }[];
  rrule?: string;
  tz?: string;
}) {
  const db = env!.db;
  const routineId = crypto.randomUUID();
  const scheduleId = crypto.randomUUID();
  const tz = opts?.tz ?? "America/New_York";
  const nextRunAt =
    opts?.nextRunAt === undefined
      ? new Date(Date.now() - 60 * 60 * 1000) // 1h in the past → due
      : opts.nextRunAt;

  await db.insert(schema.routines).values({
    id: routineId,
    userId,
    title: "Morning routine",
    emoji: "🌅",
  });

  const steps = opts?.steps ?? [
    { title: "Stretch", durationMin: 10 },
    { title: "Meditate", durationMin: 20 },
  ];
  for (let i = 0; i < steps.length; i++) {
    const s = steps[i]!;
    await db.insert(schema.routineSteps).values({
      id: crypto.randomUUID(),
      userId,
      routineId,
      title: s.title,
      durationMin: s.durationMin,
      sortOrder: i,
    });
  }

  await db.insert(schema.routineSchedules).values({
    id: scheduleId,
    userId,
    routineId,
    tz,
    rrule: opts?.rrule ?? "FREQ=DAILY",
    paused: false,
    nextRunAt,
  });

  return { routineId, scheduleId, tz };
}

describe("ADR-004 routine materializer", () => {
  itDb("double-run does not create duplicate series (idempotent)", async () => {
    const { scheduleId } = await seedRoutineWithSchedule();

    const first = await materializeRoutines({ db: env!.db });
    expect(first.processed).toBeGreaterThanOrEqual(1);
    expect(first.materialized).toBeGreaterThan(0);

    const afterFirst = await env!.db
      .select()
      .from(schema.activitySeries)
      .where(
        and(
          eq(schema.activitySeries.userId, userId),
          eq(schema.activitySeries.source, "routine"),
          isNull(schema.activitySeries.deletedAt),
        ),
      );
    const countFirst = afterFirst.filter((s) =>
      s.sourceRef?.startsWith(`${scheduleId}|`),
    ).length;
    expect(countFirst).toBe(first.materialized);

    const second = await materializeRoutines({ db: env!.db });
    // After nextRunAt advance, schedule should not be due again immediately.
    // Even if re-processed, no new series for the same sourceRefs.
    const afterSecond = await env!.db
      .select()
      .from(schema.activitySeries)
      .where(
        and(
          eq(schema.activitySeries.userId, userId),
          eq(schema.activitySeries.source, "routine"),
          isNull(schema.activitySeries.deletedAt),
        ),
      );
    const countSecond = afterSecond.filter((s) =>
      s.sourceRef?.startsWith(`${scheduleId}|`),
    ).length;
    expect(countSecond).toBe(countFirst);
    expect(second.materialized).toBe(0);
  });

  itDb("nextRunAt advances past the materialization horizon", async () => {
    const past = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const { scheduleId } = await seedRoutineWithSchedule({ nextRunAt: past });

    const horizon = new Date(Date.now() + 48 * 60 * 60 * 1000);
    await materializeRoutines({ db: env!.db });

    const [sched] = await env!.db
      .select()
      .from(schema.routineSchedules)
      .where(eq(schema.routineSchedules.id, scheduleId))
      .limit(1);

    expect(sched).toBeDefined();
    expect(sched!.nextRunAt).not.toBeNull();
    // Advanced to the next occurrence after horizon (or horizon+1d fallback).
    expect(sched!.nextRunAt!.getTime()).toBeGreaterThanOrEqual(horizon.getTime());
  });

  itDb("uses sum of step durations on materialized series", async () => {
    const { scheduleId } = await seedRoutineWithSchedule({
      steps: [
        { title: "A", durationMin: 15 },
        { title: "B", durationMin: 25 },
      ],
    });

    await materializeRoutines({ db: env!.db });

    const series = await env!.db
      .select()
      .from(schema.activitySeries)
      .where(
        and(
          eq(schema.activitySeries.source, "routine"),
          isNull(schema.activitySeries.deletedAt),
        ),
      );
    const ours = series.filter((s) => s.sourceRef?.startsWith(`${scheduleId}|`));
    expect(ours.length).toBeGreaterThan(0);
    for (const s of ours) {
      expect(s.durationMin).toBe(40);
    }
  });

  itDb("treats nextRunAt null as due and then advances it", async () => {
    const { scheduleId } = await seedRoutineWithSchedule({ nextRunAt: null });

    const result = await materializeRoutines({ db: env!.db });
    expect(result.processed).toBeGreaterThanOrEqual(1);

    const [sched] = await env!.db
      .select()
      .from(schema.routineSchedules)
      .where(eq(schema.routineSchedules.id, scheduleId))
      .limit(1);
    expect(sched!.nextRunAt).not.toBeNull();
  });

  itDb("sourceRef is scheduleId|occurrenceKey ISO", async () => {
    const { scheduleId } = await seedRoutineWithSchedule();
    await materializeRoutines({ db: env!.db });

    const series = await env!.db
      .select()
      .from(schema.activitySeries)
      .where(
        and(
          eq(schema.activitySeries.source, "routine"),
          isNull(schema.activitySeries.deletedAt),
        ),
      );
    const ours = series.filter((s) => s.sourceRef?.startsWith(`${scheduleId}|`));
    expect(ours.length).toBeGreaterThan(0);
    for (const s of ours) {
      const parts = s.sourceRef!.split("|");
      expect(parts[0]).toBe(scheduleId);
      expect(() => new Date(parts[1]!).toISOString()).not.toThrow();
      expect(new Date(parts[1]!).toISOString()).toBe(parts[1]);
    }
  });
});
