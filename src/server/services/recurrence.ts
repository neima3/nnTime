/**
 * Recurrence edit-scope service — ADR-001 "Edit scopes".
 *
 * Binding contract (ADR-001):
 *  - **This occurrence:** patch the occurrence row and advance the master
 *    revision atomically so If-Match remains a complete mutation guard.
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
  assertOwnedActivityReferences,
  ConflictError,
  getActivitySeries,
  NotFoundError,
  type Db,
} from "../dal";
import dbDefault from "../db";
import * as schema from "../db/schema";
import { and, eq, isNull, gte, sql } from "drizzle-orm";
import { expandSeries, parseRrule } from "../temporal/recurrence";
import { instantToWallFields, wallClockToInstant } from "../temporal/zone";

export type EditScope = "this" | "this_and_future" | "all";

export interface ActivityEditResult {
  seriesId: string;
  revision: number;
}

type ActivitySeriesRow = typeof schema.activitySeries.$inferSelect;

function inheritedSeriesValues(series: ActivitySeriesRow) {
  return {
    tz: series.tz,
    dtstartLocal: series.dtstartLocal,
    rrule: series.rrule,
    exdate: series.exdate,
    rdate: series.rdate,
    title: series.title,
    emoji: series.emoji,
    categoryId: series.categoryId,
    durationMin: series.durationMin,
    checklistTemplate: series.checklistTemplate,
    energy: series.energy,
    priority: series.priority,
    tags: series.tags,
    notes: series.notes,
    source: series.source,
    sourceRef: series.sourceRef,
  };
}

function occurrencePosition(series: ActivitySeriesRow, occurrenceKey: Date) {
  const dtstart = instantToWallFields(series.dtstartLocal, series.tz);
  const exdates = (series.exdate ?? []).map((date) => wallClockToInstant(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    dtstart.hour,
    dtstart.minute,
    dtstart.second,
    series.tz,
    "first",
  ));
  const occurrences = expandSeries({
    rrule: series.rrule,
    tz: series.tz,
    dtstart,
    from: series.dtstartLocal,
    to: new Date(occurrenceKey.getTime() + 1),
    rdates: series.rdate ?? undefined,
    exdates: exdates.length ? exdates : undefined,
    maxOccurrences: 10_000,
    durationMin: series.durationMin,
  });
  if (!occurrences.some((occurrence) => occurrence.occurrenceKey.getTime() === occurrenceKey.getTime())) {
    throw new ConflictError("invalid occurrence key", series);
  }
  if (!series.rrule) return { generatedBefore: 0 };
  const generated = expandSeries({
    rrule: series.rrule,
    tz: series.tz,
    dtstart,
    from: series.dtstartLocal,
    to: new Date(occurrenceKey.getTime() + 1),
    maxOccurrences: 10_000,
    durationMin: series.durationMin,
  });
  return {
    generatedBefore: generated.filter(
      (occurrence) => occurrence.occurrenceKey.getTime() < occurrenceKey.getTime(),
    ).length,
  };
}

function remainingRrule(rrule: string | null, generatedBefore: number): string | null {
  if (!rrule) return null;
  const count = parseRrule(rrule).count;
  if (count === undefined) return rrule;
  const remaining = count - generatedBefore;
  if (remaining < 1) return null;
  return rrule
    .split(";")
    .map((part) => part.toUpperCase().startsWith("COUNT=") ? `COUNT=${remaining}` : part)
    .join(";");
}

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
): Promise<ActivityEditResult> {
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
  if (series.source === "calendar") {
    throw new ConflictError("calendar activity is read-only", series);
  }
  occurrencePosition(series, occurrenceKey);

  switch (scope) {
    case "this":
      return editThisOccurrence(
        db, userId, series, occurrenceKey, pickOccurrencePatch(patch),
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
  series: ActivitySeriesRow,
  occurrenceKey: Date,
  patch: Record<string, unknown>,
): Promise<ActivityEditResult> {
  return db.transaction(async (tx) => {
    const tdb = tx as unknown as Db;
    const [master] = await tdb
      .update(schema.activitySeries)
      .set({ revision: series.revision + 1, updatedAt: new Date() })
      .where(and(
        eq(schema.activitySeries.id, series.id),
        eq(schema.activitySeries.userId, userId),
        eq(schema.activitySeries.revision, series.revision),
        isNull(schema.activitySeries.deletedAt),
      ))
      .returning();
    if (!master) {
      const current = await getActivitySeries(userId, series.id, { db: tdb });
      throw new ConflictError("revision mismatch", current);
    }
    await appendChangeLog(tdb, userId, "activity_series", series.id, "upsert", master.revision);
    const [occ] = await tdb
      .insert(schema.activityOccurrences)
      .values({ id: crypto.randomUUID(), userId, seriesId: series.id, occurrenceKey, ...patch })
      .onConflictDoUpdate({
        target: [schema.activityOccurrences.seriesId, schema.activityOccurrences.occurrenceKey],
        set: { ...patch, revision: sql`activity_occurrences.revision + 1`, updatedAt: new Date() } as Record<string, unknown>,
      })
      .returning();
    await appendChangeLog(tdb, userId, "activity_occurrences", occ!.id, "upsert", occ!.revision);
    return { seriesId: series.id, revision: master.revision };
  });
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
  series: ActivitySeriesRow,
  occurrenceKey: Date,
  patch: Record<string, unknown>,
): Promise<ActivityEditResult> {
  const { generatedBefore } = occurrencePosition(series, occurrenceKey);
  if (!series.rrule && !(series.rdate ?? []).some((date) => date.getTime() > occurrenceKey.getTime())) {
    return editAll(db, userId, series, patch);
  }
  return db.transaction(async (tx) => {
    const tdb = tx as unknown as Db;
    // 1. Truncate old series: add UNTIL to its RRULE (or set one if none).
    // The old series stops generating occurrences at/before occurrenceKey.
    const untilDate = new Date(occurrenceKey.getTime() - 1); // exclusive
    const truncatedRrule = series.rrule
      ? truncateRruleUntil(series.rrule, untilDate)
      : null; // one-off: nothing to truncate, just end it
    const predecessorRdate = (series.rdate ?? []).filter(
      (date) => date.getTime() < occurrenceKey.getTime(),
    );
    const [truncated] = await tdb
      .update(schema.activitySeries)
      .set({
        rrule: truncatedRrule,
        rdate: predecessorRdate,
        revision: series.revision + 1,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.activitySeries.id, series.id),
          eq(schema.activitySeries.userId, userId),
          eq(schema.activitySeries.revision, series.revision),
          isNull(schema.activitySeries.deletedAt),
        ),
      )
      .returning();
    if (!truncated) {
      const current = await getActivitySeries(userId, series.id, { db: tdb });
      throw new ConflictError("revision mismatch", current);
    }
    await appendChangeLog(
      tdb,
      userId,
      "activity_series",
      series.id,
      "upsert",
      truncated.revision,
    );

    // 2. Create the new series starting at occurrenceKey with the patch applied.
    const newSeriesId = crypto.randomUUID();
    const successor = {
      ...inheritedSeriesValues(series),
      dtstartLocal: occurrenceKey,
      rrule: Object.prototype.hasOwnProperty.call(patch, "rrule")
        ? patch.rrule
        : remainingRrule(series.rrule, generatedBefore),
      rdate: Object.prototype.hasOwnProperty.call(patch, "rdate")
        ? patch.rdate
        : (series.rdate ?? []).filter((date) => date.getTime() >= occurrenceKey.getTime()),
      ...patch,
    };
    await assertOwnedActivityReferences(
      tdb,
      userId,
      successor.categoryId ?? undefined,
      successor.tags ?? undefined,
    );
    const [newSeries] = await tdb
      .insert(schema.activitySeries)
      .values({
        id: newSeriesId,
        userId,
        ...successor,
        revision: 1,
      } as typeof schema.activitySeries.$inferInsert)
      .returning();

    await appendChangeLog(tdb, userId, "activity_series", newSeriesId, "upsert", 1);

    // 3. Move overrides at/after the split to the new series.
    await tdb
      .update(schema.activityOccurrences)
      .set({ seriesId: newSeriesId })
      .where(
        and(
          eq(schema.activityOccurrences.seriesId, series.id),
          eq(schema.activityOccurrences.userId, userId),
          gte(schema.activityOccurrences.occurrenceKey, occurrenceKey),
        ),
      );
    return { seriesId: newSeriesId, revision: newSeries!.revision };
  });
}

/** All: update the master series row. */
async function editAll(
  db: Db,
  userId: string,
  series: ActivitySeriesRow,
  patch: Record<string, unknown>,
): Promise<ActivityEditResult> {
  if (Object.keys(patch).length === 0) {
    return { seriesId: series.id, revision: series.revision };
  }
  return db.transaction(async (tx) => {
    const tdb = tx as unknown as Db;
    const hasCategory = Object.prototype.hasOwnProperty.call(patch, "categoryId");
    const hasTags = Object.prototype.hasOwnProperty.call(patch, "tags");
    await assertOwnedActivityReferences(
      tdb,
      userId,
      hasCategory ? (patch.categoryId as string | null) ?? undefined : undefined,
      hasTags ? (patch.tags as string[] | null) ?? undefined : undefined,
    );
    const [updated] = await tdb
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
          eq(schema.activitySeries.revision, series.revision),
          isNull(schema.activitySeries.deletedAt),
        ),
      )
      .returning();
    if (!updated) {
      const current = await getActivitySeries(userId, series.id, { db: tdb });
      throw new ConflictError("revision mismatch", current);
    }
    await appendChangeLog(
      tdb,
      userId,
      "activity_series",
      series.id,
      "upsert",
      updated.revision,
    );
    return { seriesId: series.id, revision: updated.revision };
  });
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
    await editSeriesOccurrence(
      userId, seriesId, occurrenceKey, "this", { status: "cancelled" }, ifMatchRevision, opts,
    );
    return;
  }
  if (scope === "all") throw new Error("deleteScope=all must use deleteActivitySeries");
  const db = opts.db ?? dbDefault;
  const [series] = await db.select().from(schema.activitySeries).where(and(
    eq(schema.activitySeries.id, seriesId),
    eq(schema.activitySeries.userId, userId),
    isNull(schema.activitySeries.deletedAt),
  )).limit(1);
  if (!series) throw new NotFoundError("activity_series");
  if (series.revision !== ifMatchRevision) throw new ConflictError("revision mismatch", series);
  if (series.source === "calendar") throw new ConflictError("calendar activity is read-only", series);
  occurrencePosition(series, occurrenceKey);
  await db.transaction(async (tx) => {
    const tdb = tx as unknown as Db;
    const hasPast = series.dtstartLocal.getTime() < occurrenceKey.getTime()
      || (series.rdate ?? []).some((date) => date.getTime() < occurrenceKey.getTime());
    const [updated] = await tdb.update(schema.activitySeries).set({
      ...(hasPast ? {
        rrule: series.rrule ? truncateRruleUntil(series.rrule, new Date(occurrenceKey.getTime() - 1)) : null,
        rdate: (series.rdate ?? []).filter((date) => date.getTime() < occurrenceKey.getTime()),
      } : { deletedAt: new Date() }),
      revision: series.revision + 1,
      updatedAt: new Date(),
    }).where(and(
      eq(schema.activitySeries.id, series.id),
      eq(schema.activitySeries.userId, userId),
      eq(schema.activitySeries.revision, series.revision),
      isNull(schema.activitySeries.deletedAt),
    )).returning();
    if (!updated) {
      const current = await getActivitySeries(userId, series.id, { db: tdb });
      throw new ConflictError("revision mismatch", current);
    }
    await appendChangeLog(tdb, userId, "activity_series", series.id, hasPast ? "upsert" : "delete", updated.revision);
  });
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
