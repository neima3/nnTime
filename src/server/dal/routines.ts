/**
 * Routines, routine steps and routine schedules (ADR-004, ADR-005 SEC-01).
 *
 * Every query scopes by the authenticated session's userId IN THE SAME
 * PREDICATE. See `./index.ts` for the DAL-wide contract.
 */
import "server-only";
import dbDefault from "../db";
import * as schema from "../db/schema";
import { and, eq, gte, inArray, isNull, asc, sql } from "drizzle-orm";
import type { Db } from "./types";
import { ConflictError, NotFoundError } from "./errors";
import { appendChangeLog } from "./change-log";

/* -------------------------------------------------------------------------- */
/* Routines                                                                   */
/* -------------------------------------------------------------------------- */

export async function listRoutines(userId: string, opts: { db?: Db } = {}) {
  const db = opts.db ?? dbDefault;
  return db
    .select()
    .from(schema.routines)
    .where(and(eq(schema.routines.userId, userId), isNull(schema.routines.deletedAt)))
    .orderBy(asc(schema.routines.createdAt));
}

export async function getRoutine(userId: string, id: string, opts: { db?: Db } = {}) {
  const db = opts.db ?? dbDefault;
  const [row] = await db
    .select()
    .from(schema.routines)
    .where(and(eq(schema.routines.id, id), eq(schema.routines.userId, userId)))
    .limit(1);
  if (!row || row.deletedAt) throw new NotFoundError("routine");
  return row;
}

export async function createRoutine(
  userId: string,
  input: {
    title: string;
    emoji?: string;
    categoryId?: string;
    notes?: string;
    steps?: { title: string; durationMin?: number | null }[];
    schedule?: {
      tz: string;
      rrule?: string | null;
      paused?: boolean;
    };
  },
  opts: { db?: Db } = {},
) {
  const db = opts.db ?? dbDefault;
  return db.transaction(async (tx) => {
    const tdb = tx as unknown as Db;
    const id = crypto.randomUUID();
    const [routine] = await tdb
      .insert(schema.routines)
      .values({
        id,
        userId,
        title: input.title,
        emoji: input.emoji,
        categoryId: input.categoryId,
        notes: input.notes,
      })
      .returning();
    const steps = input.steps ?? [];
    for (let i = 0; i < steps.length; i++) {
      const s = steps[i]!;
      await tdb.insert(schema.routineSteps).values({
        id: crypto.randomUUID(),
        userId,
        routineId: id,
        title: s.title,
        durationMin: s.durationMin ?? null,
        sortOrder: i,
      });
    }
    await appendChangeLog(tdb, userId, "routines", id, "upsert", routine!.revision);
    if (input.schedule) {
      const scheduleId = crypto.randomUUID();
      const [schedule] = await tdb
        .insert(schema.routineSchedules)
        .values({
          id: scheduleId,
          userId,
          routineId: id,
          tz: input.schedule.tz,
          rrule: input.schedule.rrule ?? null,
          paused: input.schedule.paused ?? false,
        })
        .returning();
      await appendChangeLog(
        tdb,
        userId,
        "routine_schedules",
        scheduleId,
        "upsert",
        schedule!.revision,
      );
    }
    return routine!;
  });
}

export async function updateRoutine(
  userId: string,
  id: string,
  input: Partial<{
    title: string;
    emoji: string | null;
    categoryId: string | null;
    notes: string | null;
  }>,
  ifMatchRevision: number,
  opts: { db?: Db } = {},
) {
  const db = opts.db ?? dbDefault;
  return db.transaction(async (tx) => {
    const tdb = tx as unknown as Db;
    const [updated] = await tdb
      .update(schema.routines)
      .set({ ...input, revision: ifMatchRevision + 1, updatedAt: new Date() })
      .where(
        and(
          eq(schema.routines.id, id),
          eq(schema.routines.userId, userId),
          eq(schema.routines.revision, ifMatchRevision),
          isNull(schema.routines.deletedAt),
        ),
      )
      .returning();
    if (!updated) {
      try {
        const existing = await getRoutine(userId, id, { db: tdb });
        throw new ConflictError("revision mismatch", existing);
      } catch (e) {
        if (e instanceof ConflictError) throw e;
        if (e instanceof NotFoundError) throw e;
        throw e;
      }
    }
    await appendChangeLog(tdb, userId, "routines", id, "upsert", updated.revision);
    return updated;
  });
}

export async function deleteRoutine(
  userId: string,
  id: string,
  ifMatchRevision: number,
  opts: { db?: Db } = {},
) {
  const db = opts.db ?? dbDefault;
  return db.transaction(async (tx) => {
    const tdb = tx as unknown as Db;
    const [updated] = await tdb
      .update(schema.routines)
      .set({ deletedAt: new Date(), revision: ifMatchRevision + 1 })
      .where(
        and(
          eq(schema.routines.id, id),
          eq(schema.routines.userId, userId),
          eq(schema.routines.revision, ifMatchRevision),
          isNull(schema.routines.deletedAt),
        ),
      )
      .returning();
    if (!updated) {
      try {
        const existing = await getRoutine(userId, id, { db: tdb });
        throw new ConflictError("revision mismatch", existing);
      } catch (e) {
        if (e instanceof ConflictError) throw e;
        if (e instanceof NotFoundError) throw e;
        throw e;
      }
    }
    // Soft-deleting only the parent left steps, schedules and already-
    // materialized days live, so a deleted routine kept appearing on Today.
    const now = new Date();
    const schedules = await tdb
      .update(schema.routineSchedules)
      .set({ deletedAt: now, revision: sql`${schema.routineSchedules.revision} + 1` })
      .where(
        and(
          eq(schema.routineSchedules.routineId, id),
          eq(schema.routineSchedules.userId, userId),
          isNull(schema.routineSchedules.deletedAt),
        ),
      )
      .returning();
    for (const sched of schedules) {
      await appendChangeLog(
        tdb,
        userId,
        "routine_schedules",
        sched.id,
        "delete",
        sched.revision,
      );
    }
    const steps = await tdb
      .update(schema.routineSteps)
      .set({ deletedAt: now, revision: sql`${schema.routineSteps.revision} + 1` })
      .where(
        and(
          eq(schema.routineSteps.routineId, id),
          eq(schema.routineSteps.userId, userId),
          isNull(schema.routineSteps.deletedAt),
        ),
      )
      .returning();
    for (const step of steps) {
      await appendChangeLog(
        tdb,
        userId,
        "routine_steps",
        step.id,
        "delete",
        step.revision,
      );
    }
    await cancelPendingRoutineSeries(
      tdb,
      userId,
      schedules.map((s) => s.id),
      now,
    );

    await appendChangeLog(tdb, userId, "routines", id, "delete", updated.revision);
  });
}

/**
 * Tombstone still-pending activity_series materialized from the given routine
 * schedules (ADR-004: "schedule edits cancel/regenerate pending rows").
 *
 * The materializer writes one-off series with `source='routine'` and
 * `sourceRef = "<scheduleId>|<occurrenceKey>"`, so a deleted or paused routine
 * previously kept showing up on Today from rows written before the change.
 * Only future occurrences are cancelled — past ones are history and stay.
 */
async function cancelPendingRoutineSeries(
  tdb: Db,
  userId: string,
  scheduleIds: string[],
  from: Date,
) {
  if (scheduleIds.length === 0) return;
  const pending = await tdb
    .update(schema.activitySeries)
    .set({ deletedAt: from, revision: sql`${schema.activitySeries.revision} + 1` })
    .where(
      and(
        eq(schema.activitySeries.userId, userId),
        eq(schema.activitySeries.source, "routine"),
        inArray(
          sql`split_part(${schema.activitySeries.sourceRef}, '|', 1)`,
          scheduleIds,
        ),
        gte(schema.activitySeries.dtstartLocal, from),
        isNull(schema.activitySeries.deletedAt),
      ),
    )
    .returning();
  for (const row of pending) {
    await appendChangeLog(
      tdb,
      userId,
      "activity_series",
      row.id,
      "delete",
      row.revision,
    );
  }
}

export async function listRoutineSteps(
  userId: string,
  routineId: string,
  opts: { db?: Db } = {},
) {
  const db = opts.db ?? dbDefault;
  await getRoutine(userId, routineId, opts);
  return db
    .select()
    .from(schema.routineSteps)
    .where(
      and(
        eq(schema.routineSteps.routineId, routineId),
        eq(schema.routineSteps.userId, userId),
        isNull(schema.routineSteps.deletedAt),
      ),
    )
    .orderBy(asc(schema.routineSteps.sortOrder));
}

export async function listRoutineSchedules(
  userId: string,
  routineId: string,
  opts: { db?: Db } = {},
) {
  const db = opts.db ?? dbDefault;
  await getRoutine(userId, routineId, opts);
  return db
    .select()
    .from(schema.routineSchedules)
    .where(
      and(
        eq(schema.routineSchedules.routineId, routineId),
        eq(schema.routineSchedules.userId, userId),
        isNull(schema.routineSchedules.deletedAt),
      ),
    );
}

export async function createRoutineSchedule(
  userId: string,
  input: {
    routineId: string;
    tz: string;
    rrule?: string | null;
    paused?: boolean;
  },
  opts: { db?: Db } = {},
) {
  const db = opts.db ?? dbDefault;
  await getRoutine(userId, input.routineId, opts);
  return db.transaction(async (tx) => {
    const tdb = tx as unknown as Db;
    const id = crypto.randomUUID();
    const [sched] = await tdb
      .insert(schema.routineSchedules)
      .values({
        id,
        userId,
        routineId: input.routineId,
        tz: input.tz,
        rrule: input.rrule ?? null,
        paused: input.paused ?? false,
      })
      .returning();
    await appendChangeLog(tdb, userId, "routine_schedules", id, "upsert", sched!.revision);
    return sched!;
  });
}

export async function updateRoutineSchedule(
  userId: string,
  id: string,
  input: Partial<{ paused: boolean; rrule: string | null; tz: string }>,
  ifMatchRevision: number,
  opts: { db?: Db } = {},
) {
  const db = opts.db ?? dbDefault;
  return db.transaction(async (tx) => {
    const tdb = tx as unknown as Db;
    const [updated] = await tdb
      .update(schema.routineSchedules)
      .set({ ...input, revision: ifMatchRevision + 1, updatedAt: new Date() })
      .where(
        and(
          eq(schema.routineSchedules.id, id),
          eq(schema.routineSchedules.userId, userId),
          eq(schema.routineSchedules.revision, ifMatchRevision),
          isNull(schema.routineSchedules.deletedAt),
        ),
      )
      .returning();
    if (!updated) {
      const [existing] = await tdb
        .select()
        .from(schema.routineSchedules)
        .where(
          and(
            eq(schema.routineSchedules.id, id),
            eq(schema.routineSchedules.userId, userId),
          ),
        )
        .limit(1);
      if (!existing || existing.deletedAt) throw new NotFoundError("routine_schedule");
      throw new ConflictError("revision mismatch", existing);
    }
    // Pausing (or re-timing) a schedule must also retire the days already
    // materialized from it, otherwise the paused routine still shows on Today.
    if (input.paused === true || input.rrule !== undefined || input.tz !== undefined) {
      await cancelPendingRoutineSeries(tdb, userId, [id], new Date());
    }
    await appendChangeLog(tdb, userId, "routine_schedules", id, "upsert", updated.revision);
    return updated;
  });
}
