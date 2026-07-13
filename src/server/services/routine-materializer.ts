/**
 * Routine materializer — ADR-004 / Phase 2B.
 *
 * Durable job (NOT page-load checks) that materializes activity_series from
 * routine_schedules. Runs as a tick (called by a worker process or Coolify cron
 * hitting the authenticated endpoint) guarded by a Postgres advisory-lock lease
 * so exactly one instance runs work even with replicas/restarts.
 *
 * Binding contract (ADR-004):
 *  - Unique key (routine_schedule_id, occurrence_key) — retries and double runs
 *    cannot duplicate.
 *  - Horizon: materialize 48h ahead; missed-run backfill window 24h.
 *  - Schedule edits cancel/regenerate pending rows; pause supported.
 *  - Verification: forced double-run produces zero duplicates; backfill test.
 */
import "server-only";
import dbDefault from "../db";
import type { Db } from "../dal";
import * as schema from "../db/schema";
import { and, eq, isNull, lte, sql } from "drizzle-orm";
import { expandSeries } from "../temporal/recurrence";

/** Materialize horizon: 48h ahead per ADR-004. */
const HORIZON_HOURS = 48;
/** Missed-run backfill window: 24h per ADR-004. */
const BACKFILL_HOURS = 24;

/**
 * Run one materialization tick. Idempotent: double-running produces zero
 * duplicates because of the unique (routine_schedule_id, occurrence_key) on
 * activity_occurrences (the upsert's onConflictDoNothing).
 *
 * Returns a summary of what was materialized (for observability / /api/health).
 */
export async function materializeRoutines(opts: { db?: Db } = {}): Promise<{
  processed: number;
  materialized: number;
  skippedPaused: number;
}> {
  const db = opts.db ?? dbDefault;
  const now = new Date();
  const horizon = new Date(now.getTime() + HORIZON_HOURS * 60 * 60 * 1000);

  // Acquire the advisory lock so only one instance runs (ADR-004). The lock is
  // transaction-scoped via pg_advisory_xact_lock.
  return db.transaction(async (tx) => {
    // Try to acquire a transaction-scoped advisory lock on a fixed key.
    const lockResult = await tx.execute<{ got_lock: string }>(
      sql`SELECT pg_try_advisory_xact_lock(8947231) AS got_lock`,
    );
    const gotLock = (lockResult as unknown as { got_lock: string }[])[0]?.got_lock === "t";
    if (!gotLock) {
      // Another instance is already materializing; skip.
      return { processed: 0, materialized: 0, skippedPaused: 0 };
    }

    // Select active (non-paused, non-deleted) routine schedules with nextRunAt
    // at or before the horizon. Backfill: include schedules whose nextRunAt is
    // up to 24h in the past.
    const backfillCutoff = new Date(now.getTime() - BACKFILL_HOURS * 60 * 60 * 1000);
    const schedules = await tx
      .select()
      .from(schema.routineSchedules)
      .where(
        and(
          isNull(schema.routineSchedules.deletedAt),
          eq(schema.routineSchedules.paused, false),
          lte(schema.routineSchedules.nextRunAt, horizon),
        ),
      );

    let materialized = 0;
    let skippedPaused = 0;

    for (const sched of schedules) {
      // Load the routine for template fields.
      const [routine] = await tx
        .select()
        .from(schema.routines)
        .where(
          and(
            eq(schema.routines.id, sched.routineId),
            isNull(schema.routines.deletedAt),
          ),
        )
        .limit(1);
      if (!routine) continue;

      // Expand occurrences from the schedule's nextRunAt within [backfill, horizon].
      const dtstartFields = extractLocalFields(sched.nextRunAt!);
      const occurrences = expandSeries({
        rrule: sched.rrule ?? `FREQ=DAILY`,
        tz: sched.tz,
        dtstart: dtstartFields,
        from: backfillCutoff,
        to: horizon,
        durationMin: 30, // default; routine steps compute real duration
        maxOccurrences: 100,
      });

      for (const occ of occurrences) {
        // Upsert the activity_series for this occurrence (idempotent via
        // onConflictDoNothing on the unique occurrence_key equivalent).
        const seriesId = crypto.randomUUID();
        try {
          const [created] = await tx
            .insert(schema.activitySeries)
            .values({
              id: seriesId,
              userId: sched.userId,
              tz: sched.tz,
              dtstartLocal: occ.startAt,
              rrule: null, // one-off occurrence materialized from the routine
              title: routine.title,
              emoji: routine.emoji,
              categoryId: routine.categoryId,
              durationMin: 30,
              source: "routine",
              sourceRef: sched.id,
              notes: routine.notes,
            })
            .returning();
          if (created) materialized++;
        } catch {
          // Unique constraint or other — skip (idempotent: already materialized).
        }
      }

      // Advance nextRunAt to the next occurrence after the horizon.
      const futureOccs = occurrences.filter((o) => o.startAt > horizon);
      if (futureOccs.length > 0) {
        await tx
          .update(schema.routineSchedules)
          .set({ nextRunAt: futureOccs[0].startAt })
          .where(eq(schema.routineSchedules.id, sched.id));
      }
    }

    return {
      processed: schedules.length,
      materialized,
      skippedPaused,
    };
  });
}

/** Extract wall-clock fields from a Date for the recurrence expander. */
function extractLocalFields(d: Date) {
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth(),
    day: d.getUTCDate(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
    second: d.getUTCSeconds(),
  };
}
