/**
 * Activity series + occurrences (ADR-001, ADR-005 SEC-01).
 *
 * Every query scopes by the authenticated session's userId IN THE SAME
 * PREDICATE. See `./index.ts` for the DAL-wide contract.
 */
import "server-only";
import dbDefault from "../db";
import * as schema from "../db/schema";
import { and, eq, inArray, isNull, asc, sql } from "drizzle-orm";
import type { Db } from "./types";
import { ConflictError, NotFoundError } from "./errors";
import { appendChangeLog } from "./change-log";
import { assertOwnedActivityReferences } from "./tags-categories-settings";

/* -------------------------------------------------------------------------- */
/* Activity series + occurrences (ADR-001)                                    */
/* -------------------------------------------------------------------------- */

export async function listActivitySeries(
  userId: string,
  opts: { db?: Db } = {},
) {
  const db = opts.db ?? dbDefault;
  return db
    .select()
    .from(schema.activitySeries)
    .where(
      and(eq(schema.activitySeries.userId, userId), isNull(schema.activitySeries.deletedAt)),
    )
    .orderBy(asc(schema.activitySeries.dtstartLocal));
}

export async function getActivitySeries(
  userId: string,
  id: string,
  opts: { db?: Db } = {},
) {
  const db = opts.db ?? dbDefault;
  const [series] = await db
    .select()
    .from(schema.activitySeries)
    .where(
      and(
        eq(schema.activitySeries.id, id),
        eq(schema.activitySeries.userId, userId),
      ),
    )
    .limit(1);
  if (!series || series.deletedAt) throw new NotFoundError("activity_series");
  return series;
}

export async function createActivitySeries(
  userId: string,
  input: {
    tz: string;
    dtstartLocal: Date;
    rrule?: string | null;
    exdate?: Date[];
    rdate?: Date[];
    title: string;
    emoji?: string;
    categoryId?: string;
    durationMin: number;
    energy?: "low" | "medium" | "high" | null;
    priority?: "none" | "low" | "high";
    tags?: string[];
    notes?: string;
    source?: "manual" | "routine" | "calendar";
    sourceRef?: string;
    checklistTemplate?: unknown[];
  },
  opts: { db?: Db } = {},
) {
  const db = opts.db ?? dbDefault;
  return db.transaction(async (tx) => {
    const tdb = tx as unknown as Db;
    const id = crypto.randomUUID();
    await assertOwnedActivityReferences(
      tdb,
      userId,
      input.categoryId,
      input.tags,
    );
    const [series] = await tdb
      .insert(schema.activitySeries)
      .values({
        id,
        userId,
        priority: input.priority ?? "none",
        source: input.source ?? "manual",
        checklistTemplate: input.checklistTemplate ?? [],
        tz: input.tz,
        dtstartLocal: input.dtstartLocal,
        rrule: input.rrule ?? null,
        exdate: input.exdate ?? null,
        rdate: input.rdate ?? null,
        title: input.title,
        emoji: input.emoji ?? null,
        categoryId: input.categoryId ?? null,
        durationMin: input.durationMin,
        energy: input.energy ?? null,
        tags: input.tags ?? null,
        notes: input.notes ?? null,
        sourceRef: input.sourceRef ?? null,
      })
      .returning();
    await appendChangeLog(tdb, userId, "activity_series", id, "upsert", series!.revision);
    return series!;
  });
}

export async function deleteActivitySeries(
  userId: string,
  id: string,
  ifMatchRevision: number,
  opts: { db?: Db } = {},
) {
  const db = opts.db ?? dbDefault;
  return db.transaction(async (tx) => {
    const tdb = tx as unknown as Db;
    const [series] = await tdb
      .select()
      .from(schema.activitySeries)
      .where(and(
        eq(schema.activitySeries.id, id),
        eq(schema.activitySeries.userId, userId),
        isNull(schema.activitySeries.deletedAt),
      ))
      .limit(1);
    if (!series) throw new NotFoundError("activity_series");
    if (series.source === "calendar") {
      throw new ConflictError("calendar activity is read-only", series);
    }
    const [updated] = await tdb
      .update(schema.activitySeries)
      .set({ deletedAt: new Date(), revision: ifMatchRevision + 1 })
      .where(
        and(
          eq(schema.activitySeries.id, id),
          eq(schema.activitySeries.userId, userId),
          eq(schema.activitySeries.revision, ifMatchRevision),
          isNull(schema.activitySeries.deletedAt),
        ),
      )
      .returning();
    if (!updated) {
      try {
        const existing = await getActivitySeries(userId, id, { db: tdb });
        throw new ConflictError("revision mismatch", existing);
      } catch (e) {
        if (e instanceof ConflictError) throw e;
        if (e instanceof NotFoundError) throw e;
        throw e;
      }
    }
    // ADR-004: deleting the activity auto-cancels a session running against it.
    // focus_sessions.activity_occurrence_id is a bare uuid with no FK, so
    // nothing did this and the timer kept counting down on a deleted activity.
    const orphaned = await tdb
      .update(schema.focusSessions)
      .set({
        state: "cancelled",
        completionReason: "activity_deleted",
        revision: sql`${schema.focusSessions.revision} + 1`,
      })
      .where(
        and(
          eq(schema.focusSessions.userId, userId),
          inArray(schema.focusSessions.state, ["running", "paused"]),
          inArray(
            schema.focusSessions.activityOccurrenceId,
            tdb
              .select({ id: schema.activityOccurrences.id })
              .from(schema.activityOccurrences)
              .where(
                and(
                  eq(schema.activityOccurrences.seriesId, id),
                  eq(schema.activityOccurrences.userId, userId),
                ),
              ),
          ),
        ),
      )
      .returning();
    for (const session of orphaned) {
      await appendChangeLog(
        tdb,
        userId,
        "focus_sessions",
        session.id,
        "upsert",
        session.revision,
      );
    }

    await appendChangeLog(tdb, userId, "activity_series", id, "delete", updated.revision);
  });
}

/* -------------------------------------------------------------------------- */
/* Activity occurrences                                                       */
/* -------------------------------------------------------------------------- */

export async function listOccurrences(
  userId: string,
  seriesId: string,
  opts: { db?: Db } = {},
) {
  const db = opts.db ?? dbDefault;
  // Verify parent ownership first (SEC-01 nested resource).
  await getActivitySeries(userId, seriesId, opts);
  return db
    .select()
    .from(schema.activityOccurrences)
    .where(
      and(
        eq(schema.activityOccurrences.seriesId, seriesId),
        eq(schema.activityOccurrences.userId, userId),
        isNull(schema.activityOccurrences.deletedAt),
      ),
    )
    .orderBy(asc(schema.activityOccurrences.startAt));
}

/** All non-deleted occurrence overrides for a user (day resolution / complete state). */
export async function listUserOccurrences(
  userId: string,
  opts: { db?: Db } = {},
) {
  const db = opts.db ?? dbDefault;
  return db
    .select()
    .from(schema.activityOccurrences)
    .where(
      and(
        eq(schema.activityOccurrences.userId, userId),
        isNull(schema.activityOccurrences.deletedAt),
      ),
    );
}

export async function upsertOccurrence(
  userId: string,
  seriesId: string,
  occurrenceKey: Date,
  input: Partial<{
    title: string;
    startAt: Date;
    durationMin: number;
    status: "pending" | "completed" | "skipped" | "cancelled";
    completedAt: Date;
  }>,
  opts: { db?: Db } = {},
) {
  const db = opts.db ?? dbDefault;
  await getActivitySeries(userId, seriesId, opts);
  return db.transaction(async (tx) => {
    const tdb = tx as unknown as Db;
    const id = crypto.randomUUID();
    const [occ] = await tdb
      .insert(schema.activityOccurrences)
      .values({
        id,
        userId,
        seriesId,
        occurrenceKey,
        ...input,
      })
      .onConflictDoUpdate({
        target: [schema.activityOccurrences.seriesId, schema.activityOccurrences.occurrenceKey],
        set: { ...input, revision: sql`activity_occurrences.revision + 1`, updatedAt: new Date() },
      })
      .returning();
    await appendChangeLog(tdb, userId, "activity_occurrences", occ!.id, "upsert", occ!.revision);
    return occ!;
  });
}
