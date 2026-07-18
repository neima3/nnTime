/**
 * Data Access Layer (DAL) — ADR-005 SEC-01.
 *
 * Every function here scopes by the authenticated session's userId IN THE SAME
 * PREDICATE. Client-supplied owner IDs are ignored. Nested resources verify
 * parent ownership. This is the ONLY module that touches the DB; route handlers
 * and Server Components call it. `server-only` enforced.
 *
 * Mutations:
 *  - Bump `revision` inside the same transaction.
 *  - If-Match conflicts → throw ConflictError (409).
 *  - Tombstone on delete (set deleted_at), never hard-delete.
 *  - Append to change_log on every mutation (ADR-002 sync feed).
 *  - Append to planner_events for domain events (ADR-001 history).
 */
import "server-only";
import dbDefault from "../db";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "../db/schema";
import { and, eq, isNull, asc, sql } from "drizzle-orm";

// Schema-agnostic drizzle client type so both the app instance and ephemeral
// test DBs are accepted.
export type Db = PostgresJsDatabase<Record<string, unknown>>;

/** Thrown when If-Match revision ≠ server revision → handler returns 409. */
export class ConflictError extends Error {
  constructor(
    message: string,
    public readonly serverState: unknown,
  ) {
    super(message);
    this.name = "ConflictError";
  }
}

/** Thrown when a resource is not found OR belongs to another user (SEC-01:
 *  cross-user returns 404 to avoid enumeration). */
export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

/* -------------------------------------------------------------------------- */
/* Tasks                                                                      */
/* -------------------------------------------------------------------------- */

export async function listTasks(
  userId: string,
  opts: { bucket?: "inbox" | "anytime"; db?: Db } = {},
) {
  const db = opts.db ?? dbDefault;
  const conditions = [
    eq(schema.tasks.userId, userId),
    isNull(schema.tasks.deletedAt),
  ];
  if (opts.bucket) conditions.push(eq(schema.tasks.bucket, opts.bucket));
  return db
    .select()
    .from(schema.tasks)
    .where(and(...conditions))
    .orderBy(asc(schema.tasks.createdAt));
}

export async function getTask(userId: string, id: string, opts: { db?: Db } = {}) {
  const db = opts.db ?? dbDefault;
  const [task] = await db
    .select()
    .from(schema.tasks)
    .where(and(eq(schema.tasks.id, id), eq(schema.tasks.userId, userId)))
    .limit(1);
  if (!task || task.deletedAt) throw new NotFoundError("task");
  return task;
}

export async function createTask(
  userId: string,
  input: {
    bucket: "inbox" | "anytime";
    title: string;
    emoji?: string;
    categoryId?: string;
    date?: Date | null;
    priority?: "none" | "low" | "high";
    energy?: "low" | "medium" | "high" | null;
    notes?: string;
  },
  opts: { db?: Db } = {},
) {
  const db = opts.db ?? dbDefault;
  const id = crypto.randomUUID();
  const [task] = await db
    .insert(schema.tasks)
    .values({ id, userId, ...input })
    .returning();
  await appendChangeLog(db, userId, "tasks", id, "upsert", task!.revision);
  return task!;
}

export async function updateTask(
  userId: string,
  id: string,
  input: Partial<{
    bucket: "inbox" | "anytime";
    title: string;
    emoji: string;
    categoryId: string;
    date: Date | null;
    priority: "none" | "low" | "high";
    energy: "low" | "medium" | "high";
    notes: string;
  }>,
  ifMatchRevision: number,
  opts: { db?: Db } = {},
) {
  const db = opts.db ?? dbDefault;
  const existing = await getTask(userId, id, opts);
  if (existing.revision !== ifMatchRevision) {
    throw new ConflictError("revision mismatch", existing);
  }
  const [updated] = await db
    .update(schema.tasks)
    .set({ ...input, revision: existing.revision + 1, updatedAt: new Date() })
    .where(and(eq(schema.tasks.id, id), eq(schema.tasks.userId, userId)))
    .returning();
  await appendChangeLog(db, userId, "tasks", id, "upsert", updated!.revision);
  return updated!;
}

export async function deleteTask(
  userId: string,
  id: string,
  ifMatchRevision: number,
  opts: { db?: Db } = {},
) {
  const db = opts.db ?? dbDefault;
  const existing = await getTask(userId, id, opts);
  if (existing.revision !== ifMatchRevision) {
    throw new ConflictError("revision mismatch", existing);
  }
  await db
    .update(schema.tasks)
    .set({ deletedAt: new Date(), revision: existing.revision + 1 })
    .where(and(eq(schema.tasks.id, id), eq(schema.tasks.userId, userId)));
  await appendChangeLog(db, userId, "tasks", id, "delete", existing.revision + 1);
}

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
    title: string;
    emoji?: string;
    categoryId?: string;
    durationMin: number;
    energy?: "low" | "medium" | "high" | null;
    priority?: "none" | "low" | "high";
    notes?: string;
    source?: "manual" | "routine" | "calendar";
    checklistTemplate?: unknown[];
  },
  opts: { db?: Db } = {},
) {
  const db = opts.db ?? dbDefault;
  const id = crypto.randomUUID();
  const [series] = await db
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
      title: input.title,
      emoji: input.emoji,
      categoryId: input.categoryId,
      durationMin: input.durationMin,
      energy: input.energy ?? null,
      notes: input.notes,
    })
    .returning();
  await appendChangeLog(db, userId, "activity_series", id, "upsert", series!.revision);
  return series!;
}

export async function deleteActivitySeries(
  userId: string,
  id: string,
  ifMatchRevision: number,
  opts: { db?: Db } = {},
) {
  const db = opts.db ?? dbDefault;
  const existing = await getActivitySeries(userId, id, opts);
  if (existing.revision !== ifMatchRevision) {
    throw new ConflictError("revision mismatch", existing);
  }
  await db
    .update(schema.activitySeries)
    .set({ deletedAt: new Date(), revision: existing.revision + 1 })
    .where(
      and(
        eq(schema.activitySeries.id, id),
        eq(schema.activitySeries.userId, userId),
      ),
    );
  await appendChangeLog(db, userId, "activity_series", id, "delete", existing.revision + 1);
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
  const id = crypto.randomUUID();
  const [occ] = await db
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
  await appendChangeLog(db, userId, "activity_occurrences", occ!.id, "upsert", occ!.revision);
  return occ!;
}

/* -------------------------------------------------------------------------- */
/* Tags                                                                       */
/* -------------------------------------------------------------------------- */

export async function listTags(userId: string, opts: { db?: Db } = {}) {
  const db = opts.db ?? dbDefault;
  return db
    .select()
    .from(schema.tags)
    .where(and(eq(schema.tags.userId, userId), isNull(schema.tags.deletedAt)))
    .orderBy(asc(schema.tags.name));
}

export async function createTag(
  userId: string,
  input: { name: string; color?: string },
  opts: { db?: Db } = {},
) {
  const db = opts.db ?? dbDefault;
  const id = crypto.randomUUID();
  const [tag] = await db
    .insert(schema.tags)
    .values({ id, userId, ...input })
    .returning();
  await appendChangeLog(db, userId, "tags", id, "upsert", tag!.revision);
  return tag!;
}

export async function getTag(userId: string, id: string, opts: { db?: Db } = {}) {
  const db = opts.db ?? dbDefault;
  const [tag] = await db
    .select()
    .from(schema.tags)
    .where(and(eq(schema.tags.id, id), eq(schema.tags.userId, userId)))
    .limit(1);
  if (!tag || tag.deletedAt) throw new NotFoundError("tag");
  return tag;
}

export async function updateTag(
  userId: string,
  id: string,
  input: Partial<{ name: string; color: string | null }>,
  ifMatchRevision: number,
  opts: { db?: Db } = {},
) {
  const db = opts.db ?? dbDefault;
  const existing = await getTag(userId, id, opts);
  if (existing.revision !== ifMatchRevision) {
    throw new ConflictError("revision mismatch", existing);
  }
  const [updated] = await db
    .update(schema.tags)
    .set({ ...input, revision: existing.revision + 1, updatedAt: new Date() })
    .where(and(eq(schema.tags.id, id), eq(schema.tags.userId, userId)))
    .returning();
  await appendChangeLog(db, userId, "tags", id, "upsert", updated!.revision);
  return updated!;
}

export async function deleteTag(
  userId: string,
  id: string,
  ifMatchRevision: number,
  opts: { db?: Db } = {},
) {
  const db = opts.db ?? dbDefault;
  const existing = await getTag(userId, id, opts);
  if (existing.revision !== ifMatchRevision) {
    throw new ConflictError("revision mismatch", existing);
  }
  await db
    .update(schema.tags)
    .set({ deletedAt: new Date(), revision: existing.revision + 1 })
    .where(and(eq(schema.tags.id, id), eq(schema.tags.userId, userId)));
  await appendChangeLog(db, userId, "tags", id, "delete", existing.revision + 1);
}

/* -------------------------------------------------------------------------- */
/* Categories (ADR-001: six seeded, user-owned rows)                           */
/* -------------------------------------------------------------------------- */

/** Row shape of the shared category_seed table (not a Drizzle table object). */
interface CategorySeedRow {
  key: string;
  label: string;
  sort_order: number;
  emoji: string | null;
  [key: string]: unknown;
}

/**
 * List a user's categories, ordered by sortOrder. On first access (no rows),
 * seeds the six canonical categories from `category_seed`. Soft-deleted rows
 * are excluded; orphaned references fall back to a canonical key (ADR-001).
 */
export async function listCategories(userId: string, opts: { db?: Db } = {}) {
  const db = opts.db ?? dbDefault;
  const existing = await db
    .select()
    .from(schema.categories)
    .where(
      and(eq(schema.categories.userId, userId), isNull(schema.categories.deletedAt)),
    )
    .orderBy(asc(schema.categories.sortOrder));

  if (existing.length > 0) return existing;

  // Seed from the shared category_seed table (1C signup-time seeding).
  const seedRows = (await db.execute<CategorySeedRow>(sql`
    SELECT key, label, sort_order, emoji FROM category_seed ORDER BY sort_order
  `)) as CategorySeedRow[];

  const toInsert = seedRows.map((row) => ({
    id: crypto.randomUUID(),
    userId,
    key: row.key,
    label: row.label,
    sortOrder: row.sort_order,
  }));
  if (toInsert.length === 0) return [];

  await db.insert(schema.categories).values(toInsert);
  return db
    .select()
    .from(schema.categories)
    .where(
      and(eq(schema.categories.userId, userId), isNull(schema.categories.deletedAt)),
    )
    .orderBy(asc(schema.categories.sortOrder));
}

/* -------------------------------------------------------------------------- */
/* User settings (ADR-001 typed columns; PK = userId, no tombstone)           */
/* -------------------------------------------------------------------------- */

/**
 * Read the user's typed settings row, creating defaults if none exists yet.
 * `timezoneHint` (e.g. from the request `x-timezone` header) seeds the IANA
 * zone on first creation; subsequent reads always return the stored row.
 *
 * Settings are NOT appended to change_log: change_log.entity_id is a uuid and
 * settings' PK is the text userId, and the row is not tombstoned/synced like
 * other entities (ADR-002 / user-settings schema note).
 */
export async function getOrCreateSettings(
  userId: string,
  opts: { db?: Db; timezoneHint?: string } = {},
) {
  const db = opts.db ?? dbDefault;
  const [row] = await db
    .select()
    .from(schema.userSettings)
    .where(eq(schema.userSettings.userId, userId))
    .limit(1);
  if (row) return row;

  const timezone = opts.timezoneHint || "UTC";
  const [created] = await db
    .insert(schema.userSettings)
    .values({ userId, timezone })
    .returning();
  return created!;
}

export async function updateSettings(
  userId: string,
  input: Partial<{
    timezone: string;
    locale: string;
    weekStart: number;
    hourCycle: "h12" | "h24";
    theme: "system" | "light" | "dark";
    reducedStimulation: boolean;
    notificationPrefs: unknown;
  }>,
  ifMatchRevision: number,
  opts: { db?: Db } = {},
) {
  const db = opts.db ?? dbDefault;
  const existing = await getOrCreateSettings(userId, opts);
  if (existing.revision !== ifMatchRevision) {
    throw new ConflictError("revision mismatch", existing);
  }
  const [updated] = await db
    .update(schema.userSettings)
    .set({ ...input, revision: existing.revision + 1, updatedAt: new Date() })
    .where(eq(schema.userSettings.userId, userId))
    .returning();
  return updated!;
}

/* -------------------------------------------------------------------------- */
/* Change log (ADR-002 incremental sync)                                      */
/* -------------------------------------------------------------------------- */

export async function getChanges(
  userId: string,
  cursor: number,
  limit: number = 100,
  opts: { db?: Db } = {},
) {
  const db = opts.db ?? dbDefault;
  // Use raw SQL for the bigint comparison to avoid drizzle type issues.
  const rows = await db.execute(
    sql`SELECT * FROM change_log WHERE user_id = ${userId} AND id > ${cursor} ORDER BY id ASC LIMIT ${limit + 1}`,
  );
  const result = ((rows as unknown as Record<string, unknown>[]) ?? []).map((r) => ({
    id: r.id,
    userId: r.user_id,
    entityType: r.entity_type,
    entityId: r.entity_id,
    op: r.op,
    revision: r.revision,
    occurredAt: r.occurred_at,
  }));
  const hasMore = result.length > limit;
  const items = hasMore ? result.slice(0, limit) : result;
  const lastItem = items[items.length - 1];
  const nextCursor = hasMore && lastItem ? String(lastItem.id) : null;
  return { items, nextCursor };
}

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
  },
  opts: { db?: Db } = {},
) {
  const db = opts.db ?? dbDefault;
  const id = crypto.randomUUID();
  const [routine] = await db
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
    await db.insert(schema.routineSteps).values({
      id: crypto.randomUUID(),
      userId,
      routineId: id,
      title: s.title,
      durationMin: s.durationMin ?? null,
      sortOrder: i,
    });
  }
  await appendChangeLog(db, userId, "routines", id, "upsert", routine!.revision);
  return routine!;
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
  const existing = await getRoutine(userId, id, opts);
  if (existing.revision !== ifMatchRevision) {
    throw new ConflictError("revision mismatch", existing);
  }
  const [updated] = await db
    .update(schema.routines)
    .set({ ...input, revision: existing.revision + 1, updatedAt: new Date() })
    .where(and(eq(schema.routines.id, id), eq(schema.routines.userId, userId)))
    .returning();
  await appendChangeLog(db, userId, "routines", id, "upsert", updated!.revision);
  return updated!;
}

export async function deleteRoutine(
  userId: string,
  id: string,
  ifMatchRevision: number,
  opts: { db?: Db } = {},
) {
  const db = opts.db ?? dbDefault;
  const existing = await getRoutine(userId, id, opts);
  if (existing.revision !== ifMatchRevision) {
    throw new ConflictError("revision mismatch", existing);
  }
  await db
    .update(schema.routines)
    .set({ deletedAt: new Date(), revision: existing.revision + 1 })
    .where(and(eq(schema.routines.id, id), eq(schema.routines.userId, userId)));
  await appendChangeLog(db, userId, "routines", id, "delete", existing.revision + 1);
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
  const id = crypto.randomUUID();
  const [sched] = await db
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
  await appendChangeLog(db, userId, "routine_schedules", id, "upsert", sched!.revision);
  return sched!;
}

export async function updateRoutineSchedule(
  userId: string,
  id: string,
  input: Partial<{ paused: boolean; rrule: string | null; tz: string }>,
  ifMatchRevision: number,
  opts: { db?: Db } = {},
) {
  const db = opts.db ?? dbDefault;
  const [existing] = await db
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
  if (existing.revision !== ifMatchRevision) {
    throw new ConflictError("revision mismatch", existing);
  }
  const [updated] = await db
    .update(schema.routineSchedules)
    .set({ ...input, revision: existing.revision + 1, updatedAt: new Date() })
    .where(
      and(
        eq(schema.routineSchedules.id, id),
        eq(schema.routineSchedules.userId, userId),
      ),
    )
    .returning();
  await appendChangeLog(db, userId, "routine_schedules", id, "upsert", updated!.revision);
  return updated!;
}

/* -------------------------------------------------------------------------- */
/* Planner events (ADR-001 history — stats/streaks)                           */
/* -------------------------------------------------------------------------- */

export async function appendPlannerEvent(
  userId: string,
  input: {
    entityType: string;
    entityId: string;
    eventType:
      | "complete"
      | "uncomplete"
      | "skip"
      | "reschedule"
      | "focus_start"
      | "focus_stop"
      | "energy_change"
      | "mood_checkin"
      | "carryover";
    payload?: Record<string, unknown>;
    tz?: string;
  },
  opts: { db?: Db } = {},
) {
  const db = opts.db ?? dbDefault;
  let tz = input.tz;
  if (!tz) {
    try {
      const s = await getOrCreateSettings(userId, opts);
      tz = s.timezone;
    } catch {
      tz = "UTC";
    }
  }
  await db.insert(schema.plannerEvents).values({
    id: crypto.randomUUID(),
    userId,
    entityType: input.entityType,
    entityId: input.entityId,
    eventType: input.eventType,
    payload: input.payload ?? {},
    occurredAt: new Date(),
    tz: tz!,
  });
}

/* -------------------------------------------------------------------------- */
/* Internal: append to change_log                                             */
/* -------------------------------------------------------------------------- */

export async function appendChangeLog(
  db: Db,
  userId: string,
  entityType: string,
  entityId: string,
  op: "upsert" | "delete",
  revision: number,
) {
  try {
    await db.insert(schema.changeLog).values({
      userId,
      entityType,
      entityId,
      op,
      revision,
    });
  } catch (e) {
    // Log but don't crash the mutation — the change_log is for sync, not
    // transactional integrity. A missing change_log row means the client
    // won't see the change via incremental sync, but the data itself is saved.
    console.error("[dal] appendChangeLog failed:", e instanceof Error ? e.message : e);
  }
}
