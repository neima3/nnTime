/**
 * Routine materializer — ADR-004 / Phase 2B / Wave 2C.
 *
 * Durable job (NOT page-load checks) that materializes activity_series from
 * routine_schedules. Runs as a tick (called by a worker process or Coolify cron
 * hitting the authenticated endpoint) guarded by a Postgres advisory-lock lease
 * so exactly one instance runs work even with replicas/restarts.
 *
 * Binding contract (ADR-004):
 *  - Unique key (routine_schedule_id, occurrence_key) via sourceRef —
 *    retries and double runs cannot duplicate.
 *  - Horizon: materialize 48h ahead; missed-run backfill window 24h.
 *  - Schedule edits cancel/regenerate pending rows; pause supported.
 *  - Verification: forced double-run produces zero duplicates; nextRunAt advances.
 */
import "server-only";
import dbDefault from "../db";
import type { Db } from "../dal";
import * as schema from "../db/schema";
import { and, eq, gte, isNull, lte, or, sql } from "drizzle-orm";
import { expandSeries } from "../temporal/recurrence";
import { instantToWallFields } from "../temporal/zone";

/** Materialize horizon: 48h ahead per ADR-004. */
const HORIZON_HOURS = 48;
/** Missed-run backfill window: 24h per ADR-004. */
const BACKFILL_HOURS = 24;
const MS_DAY = 24 * 60 * 60 * 1000;
const MS_HOUR = 60 * 60 * 1000;

/**
 * Parse pg_try_advisory_xact_lock result across postgres-js / drizzle shapes.
 * Drivers may return boolean true/false, or legacy 't'/'f' strings.
 */
function parseAdvisoryLock(result: unknown): boolean {
  const rows: unknown[] = Array.isArray(result)
    ? result
    : result &&
        typeof result === "object" &&
        "rows" in result &&
        Array.isArray((result as { rows: unknown[] }).rows)
      ? (result as { rows: unknown[] }).rows
      : [];
  const row = rows[0];
  if (!row || typeof row !== "object") return false;
  const rec = row as Record<string, unknown>;
  const v = rec.got_lock ?? rec.pg_try_advisory_xact_lock;
  return v === true || v === "t" || v === "true" || v === 1 || v === "1";
}

/**
 * Run one materialization tick. Idempotent: double-running produces zero
 * duplicates because of sourceRef dedupe (`scheduleId|occurrenceKey`) plus
 * try/catch for concurrent races.
 *
 * Returns a summary of what was materialized (for observability / /api/health).
 */
export async function materializeRoutines(opts: { db?: Db } = {}): Promise<{
  processed: number;
  materialized: number;
  skippedPaused: number;
  skippedDuplicate: number;
}> {
  const db = opts.db ?? dbDefault;
  const now = new Date();
  const horizon = new Date(now.getTime() + HORIZON_HOURS * MS_HOUR);
  const backfillCutoff = new Date(now.getTime() - BACKFILL_HOURS * MS_HOUR);

  return db.transaction(async (tx) => {
    const lockResult = await tx.execute(
      sql`SELECT pg_try_advisory_xact_lock(8947231) AS got_lock`,
    );
    if (!parseAdvisoryLock(lockResult)) {
      return {
        processed: 0,
        materialized: 0,
        skippedPaused: 0,
        skippedDuplicate: 0,
      };
    }

    // Due schedules: nextRunAt <= horizon (and not older than backfill), OR null
    // (null treated as due now). Paused / soft-deleted excluded.
    const schedules = await tx
      .select()
      .from(schema.routineSchedules)
      .where(
        and(
          isNull(schema.routineSchedules.deletedAt),
          eq(schema.routineSchedules.paused, false),
          or(
            isNull(schema.routineSchedules.nextRunAt),
            and(
              lte(schema.routineSchedules.nextRunAt, horizon),
              gte(schema.routineSchedules.nextRunAt, backfillCutoff),
            ),
          ),
        ),
      );

    let materialized = 0;
    let skippedDuplicate = 0;
    const skippedPaused = 0;

    for (const sched of schedules) {
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

      // Duration = sum of step durations; default 30 if no steps / zero sum.
      const steps = await tx
        .select()
        .from(schema.routineSteps)
        .where(
          and(
            eq(schema.routineSteps.routineId, sched.routineId),
            isNull(schema.routineSteps.deletedAt),
          ),
        );
      const stepSum = steps.reduce((sum, s) => sum + (s.durationMin ?? 0), 0);
      const durationMin = stepSum > 0 ? stepSum : 30;

      // Wall-clock seed in the schedule's zone (not UTC getUTC*).
      // nextRunAt null → treat as due now (seed from current wall clock).
      const seedInstant = sched.nextRunAt ?? now;
      const dtstartFields = instantToWallFields(seedInstant, sched.tz);
      const rrule = sched.rrule ?? "FREQ=DAILY";

      const occurrences = expandSeries({
        rrule,
        tz: sched.tz,
        dtstart: dtstartFields,
        from: backfillCutoff,
        to: horizon,
        durationMin,
        maxOccurrences: 100,
      });

      for (const occ of occurrences) {
        // Stable dedupe key: (routine_schedule_id, occurrence_key)
        const sourceRef = `${sched.id}|${occ.occurrenceKey.toISOString()}`;

        const [existing] = await tx
          .select({ id: schema.activitySeries.id })
          .from(schema.activitySeries)
          .where(
            and(
              eq(schema.activitySeries.source, "routine"),
              eq(schema.activitySeries.sourceRef, sourceRef),
              isNull(schema.activitySeries.deletedAt),
            ),
          )
          .limit(1);
        if (existing) {
          skippedDuplicate++;
          continue;
        }

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
              durationMin,
              source: "routine",
              sourceRef,
              notes: routine.notes,
            })
            .returning();
          if (created) materialized++;
        } catch {
          // Unique race or other constraint — treat as already materialized.
          skippedDuplicate++;
        }
      }

      // Advance nextRunAt to the first occurrence at/after horizon.
      // Expand a year ahead; use enough maxOccurrences to walk from dtstart
      // past the horizon gap (DAILY counts past slots toward the cap).
      const advanceTo = new Date(horizon.getTime() + 365 * MS_DAY);
      const futureOccs = expandSeries({
        rrule,
        tz: sched.tz,
        dtstart: dtstartFields,
        from: horizon,
        to: advanceTo,
        durationMin: 1,
        maxOccurrences: 400,
      });
      const nextAfterHorizon = futureOccs.find(
        (o) => o.startAt.getTime() >= horizon.getTime(),
      );
      // Prefer real next occurrence; otherwise horizon+1d minimum advance so we
      // never reprocess the same window forever. Avoid leaving null.
      const nextRunAt =
        nextAfterHorizon?.startAt ??
        new Date(horizon.getTime() + MS_DAY);

      await tx
        .update(schema.routineSchedules)
        .set({ nextRunAt, updatedAt: new Date() })
        .where(eq(schema.routineSchedules.id, sched.id));
    }

    return {
      processed: schedules.length,
      materialized,
      skippedPaused,
      skippedDuplicate,
    };
  });
}
