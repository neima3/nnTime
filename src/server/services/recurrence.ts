/**
 * Recurrence edit-scope service — ADR-001 "Edit scopes".
 *
 * Binding contract (ADR-001):
 *  - **This occurrence:** patch the occurrence row. Master untouched.
 *  - **This and future:** transaction: truncate old series (set UNTIL before the
 *    selected occurrence) + create a new series starting there. Overrides before
 *    the split stay with the old series; at/after move to the new one.
 *    Occurrence identity (`occurrence_key`) survives the split.
 *  - **All:** update the master. Field-level overrides survive unless the edited
 *    field is the overridden field (override wins conflict).
 *
 * Completed past occurrences are never mutated by series edits.
 */
import "server-only";
import {
  appendChangeLog,
  ConflictError,
  NotFoundError,
  type Db,
} from "../dal";
import dbDefault from "../db";
import * as schema from "../db/schema";
import { and, eq, isNull, gte, sql } from "drizzle-orm";

export type EditScope = "this" | "this_and_future" | "all";

/** Whitelist of series columns safe to patch via editScope=all / this_and_future. */
const SERIES_PATCH_KEYS = new Set([
  "tz",
  "dtstartLocal",
  "rrule",
  "exdate",
  "rdate",
  "title",
  "emoji",
  "categoryId",
  "durationMin",
  "checklistTemplate",
  "energy",
  "priority",
  "tags",
  "notes",
  "source",
  "sourceRef",
]);

/** Whitelist of occurrence override columns for editScope=this. */
const OCCURRENCE_PATCH_KEYS = new Set([
  "title",
  "startAt",
  "durationMin",
  "status",
  "completedAt",
  "checklistOverride",
  "energy",
]);

export function pickSeriesPatch(patch: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    if (!SERIES_PATCH_KEYS.has(k)) continue;
    out[k] = v;
  }
  return out;
}

export function pickOccurrencePatch(patch: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    if (!OCCURRENCE_PATCH_KEYS.has(k)) continue;
    out[k] = v;
  }
  return out;
}

/**
 * Apply an edit to an activity series at a specific occurrence, honoring the
 * ADR-001 edit scope.
 */
export async function editSeriesOccurrence(
  userId: string,
  seriesId: string,
  occurrenceKey: Date,
  scope: EditScope,
  patch: Record<string, unknown>,
  ifMatchRevision: number,
  opts: { db?: Db } = {},
): Promise<void> {
  const db = opts.db ?? dbDefault;

  // Load the series (scoped by userId).
  const [series] = await db
    .select()
    .from(schema.activitySeries)
    .where(
      and(
        eq(schema.activitySeries.id, seriesId),
        eq(schema.activitySeries.userId, userId),
        isNull(schema.activitySeries.deletedAt),
      ),
    )
    .limit(1);
  if (!series) throw new NotFoundError("activity_series");
  if (series.revision !== ifMatchRevision) {
    throw new ConflictError("revision mismatch", series);
  }

  switch (scope) {
    case "this":
      return editThisOccurrence(
        db,
        userId,
        seriesId,
        occurrenceKey,
        pickOccurrencePatch(patch),
      );

    case "this_and_future":
      return editThisAndFuture(
        db,
        userId,
        series,
        occurrenceKey,
        pickSeriesPatch(patch),
      );

    case "all":
      return editAll(db, userId, series, pickSeriesPatch(patch));
  }
}

/** This occurrence: patch the occurrence override row. Master untouched. */
async function editThisOccurrence(
  db: Db,
  userId: string,
  seriesId: string,
  occurrenceKey: Date,
  patch: Record<string, unknown>,
): Promise<void> {
  // Upsert an occurrence override for this specific instance.
  const id = crypto.randomUUID();
  const [occ] = await db
    .insert(schema.activityOccurrences)
    .values({
      id,
      userId,
      seriesId,
      occurrenceKey,
      ...patch,
    })
    .onConflictDoUpdate({
      target: [schema.activityOccurrences.seriesId, schema.activityOccurrences.occurrenceKey],
      set: {
        ...patch,
        revision: sql`activity_occurrences.revision + 1`,
        updatedAt: new Date(),
      } as Record<string, unknown>,
    })
    .returning();
  await appendChangeLog(db, userId, "activity_occurrences", occ!.id, "upsert", occ!.revision);
}

/**
 * This and future: transactional series split.
 * 1. Truncate the old series (set UNTIL before the selected occurrence).
 * 2. Create a new series starting at the selected occurrence with the patch.
 * 3. Overrides at/after the split move to the new series (same occurrence_key).
 */
async function editThisAndFuture(
  db: Db,
  userId: string,
  series: { id: string; rrule: string | null; tz: string; revision: number },
  occurrenceKey: Date,
  patch: Record<string, unknown>,
): Promise<void> {
  await db.transaction(async (tx) => {
    // 1. Truncate old series: add UNTIL to its RRULE (or set one if none).
    // The old series stops generating occurrences at/before occurrenceKey.
    const untilDate = new Date(occurrenceKey.getTime() - 1); // exclusive
    const truncatedRrule = series.rrule
      ? truncateRruleUntil(series.rrule, untilDate)
      : null; // one-off: nothing to truncate, just end it
    await tx
      .update(schema.activitySeries)
      .set({
        rrule: truncatedRrule,
        revision: series.revision + 1,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.activitySeries.id, series.id),
          eq(schema.activitySeries.userId, userId),
        ),
      );

    // 2. Create the new series starting at occurrenceKey with the patch applied.
    const newSeriesId = crypto.randomUUID();
    await tx
      .insert(schema.activitySeries)
      .values({
        id: newSeriesId,
        userId,
        tz: series.tz,
        dtstartLocal: occurrenceKey,
        rrule: series.rrule,
        ...patch,
        revision: 1,
      } as typeof schema.activitySeries.$inferInsert);

    await appendChangeLog(tx as unknown as Db, userId, "activity_series", newSeriesId, "upsert", 1);

    // 3. Move overrides at/after the split to the new series.
    await tx
      .update(schema.activityOccurrences)
      .set({ seriesId: newSeriesId })
      .where(
        and(
          eq(schema.activityOccurrences.seriesId, series.id),
          gte(schema.activityOccurrences.occurrenceKey, occurrenceKey),
        ),
      );
  });
}

/** All: update the master series row. */
async function editAll(
  db: Db,
  userId: string,
  series: { id: string; revision: number },
  patch: Record<string, unknown>,
): Promise<void> {
  if (Object.keys(patch).length === 0) return;
  const [updated] = await db
    .update(schema.activitySeries)
    .set({
      ...patch,
      revision: series.revision + 1,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(schema.activitySeries.id, series.id),
        eq(schema.activitySeries.userId, userId),
      ),
    )
    .returning();
  await appendChangeLog(db, userId, "activity_series", series.id, "upsert", updated!.revision);
}

/** Delete with scope — mirrors edit scopes (ADR-001). */
export async function deleteSeriesOccurrence(
  userId: string,
  seriesId: string,
  occurrenceKey: Date,
  scope: EditScope,
  ifMatchRevision: number,
  opts: { db?: Db } = {},
): Promise<void> {
  if (scope === "this") {
    // Cancel this occurrence: insert an override with status=cancelled.
    const db = opts.db ?? dbDefault;
    await editThisOccurrence(db, userId, seriesId, occurrenceKey, { status: "cancelled" });
    return;
  }
  if (scope === "all") {
    const db = opts.db ?? dbDefault;
    await db
      .update(schema.activitySeries)
      .set({ deletedAt: new Date(), revision: ifMatchRevision + 1 })
      .where(
        and(
          eq(schema.activitySeries.id, seriesId),
          eq(schema.activitySeries.userId, userId),
        ),
      );
    return;
  }
  // this_and_future: truncate the series before this occurrence.
  await editSeriesOccurrence(
    userId,
    seriesId,
    occurrenceKey,
    "this_and_future",
    {},
    ifMatchRevision,
    opts,
  );
}

/**
 * Truncate an RRULE string by setting/replacing its UNTIL to before the given
 * date. Returns the modified RRULE.
 */
function truncateRruleUntil(rrule: string, until: Date): string {
  const parts = rrule.split(";").filter((p) => !p.toUpperCase().startsWith("UNTIL="));
  const untilStr = until.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  return `${parts.join(";")};UNTIL=${untilStr}`;
}

