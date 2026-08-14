/**
 * Tags, categories and user settings (ADR-001, ADR-005 SEC-01).
 *
 * Also owns `assertOwnedActivityReferences`, the category/tag ownership check
 * that tasks and activities run before referencing them.
 *
 * Every query scopes by the authenticated session's userId IN THE SAME
 * PREDICATE. See `./index.ts` for the DAL-wide contract.
 */
import "server-only";
import dbDefault from "../db";
import * as schema from "../db/schema";
import { and, eq, inArray, isNull, asc, sql } from "drizzle-orm";
import { isValidZone } from "../temporal/zone";
import type { Db } from "./types";
import { ConflictError, NotFoundError } from "./errors";
import { appendChangeLog } from "./change-log";

export async function assertOwnedActivityReferences(
  db: Db,
  userId: string,
  categoryId?: string,
  tags?: string[],
): Promise<void> {
  if (categoryId) {
    const [category] = await db
      .select({ id: schema.categories.id })
      .from(schema.categories)
      .where(
        and(
          eq(schema.categories.id, categoryId),
          eq(schema.categories.userId, userId),
          isNull(schema.categories.deletedAt),
        ),
      )
      .limit(1);
    if (!category) throw new NotFoundError("category");
  }
  if (tags?.length) {
    const requestedTagIds = [...new Set(tags)];
    const ownedTags = await db
      .select({ id: schema.tags.id })
      .from(schema.tags)
      .where(
        and(
          inArray(schema.tags.id, requestedTagIds),
          eq(schema.tags.userId, userId),
          isNull(schema.tags.deletedAt),
        ),
      );
    if (ownedTags.length !== requestedTagIds.length) {
      throw new NotFoundError("tag");
    }
  }
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
  return db.transaction(async (tx) => {
    const tdb = tx as unknown as Db;
    const id = crypto.randomUUID();
    const [tag] = await tdb
      .insert(schema.tags)
      .values({ id, userId, ...input })
      .returning();
    await appendChangeLog(tdb, userId, "tags", id, "upsert", tag!.revision);
    return tag!;
  });
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
  return db.transaction(async (tx) => {
    const tdb = tx as unknown as Db;
    const [updated] = await tdb
      .update(schema.tags)
      .set({ ...input, revision: ifMatchRevision + 1, updatedAt: new Date() })
      .where(
        and(
          eq(schema.tags.id, id),
          eq(schema.tags.userId, userId),
          eq(schema.tags.revision, ifMatchRevision),
          isNull(schema.tags.deletedAt),
        ),
      )
      .returning();
    if (!updated) {
      try {
        const existing = await getTag(userId, id, { db: tdb });
        throw new ConflictError("revision mismatch", existing);
      } catch (e) {
        if (e instanceof ConflictError) throw e;
        if (e instanceof NotFoundError) throw e;
        throw e;
      }
    }
    await appendChangeLog(tdb, userId, "tags", id, "upsert", updated.revision);
    return updated;
  });
}

export async function deleteTag(
  userId: string,
  id: string,
  ifMatchRevision: number,
  opts: { db?: Db } = {},
) {
  const db = opts.db ?? dbDefault;
  return db.transaction(async (tx) => {
    const tdb = tx as unknown as Db;
    const [updated] = await tdb
      .update(schema.tags)
      .set({ deletedAt: new Date(), revision: ifMatchRevision + 1 })
      .where(
        and(
          eq(schema.tags.id, id),
          eq(schema.tags.userId, userId),
          eq(schema.tags.revision, ifMatchRevision),
          isNull(schema.tags.deletedAt),
        ),
      )
      .returning();
    if (!updated) {
      try {
        const existing = await getTag(userId, id, { db: tdb });
        throw new ConflictError("revision mismatch", existing);
      } catch (e) {
        if (e instanceof ConflictError) throw e;
        if (e instanceof NotFoundError) throw e;
        throw e;
      }
    }
    await appendChangeLog(tdb, userId, "tags", id, "delete", updated.revision);
  });
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

  // Concurrent first-loads both reach the seed path — the partial unique
  // index on (user_id, key) makes the losing insert a no-op instead of a crash.
  await db.insert(schema.categories).values(toInsert).onConflictDoNothing();
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

  // The hint comes straight off an `x-timezone` request header, which never
  // passes through zod — an unvalidated value here would be persisted and then
  // throw RangeError on every later day/search read.
  const timezone =
    opts.timezoneHint && isValidZone(opts.timezoneHint)
      ? opts.timezoneHint
      : "UTC";
  // Concurrent first-loads race here (e.g. two parallel Server Component
  // renders after signup) — on conflict, another request already created the
  // row; re-read it instead of failing.
  const [created] = await db
    .insert(schema.userSettings)
    .values({ userId, timezone })
    .onConflictDoNothing({ target: schema.userSettings.userId })
    .returning();
  if (created) return created;
  const [existing] = await db
    .select()
    .from(schema.userSettings)
    .where(eq(schema.userSettings.userId, userId))
    .limit(1);
  return existing!;
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
  // Ensure row exists (settings has no tombstone; create-on-missing).
  // No change_log for settings (entity_id is uuid; settings PK is text userId).
  await getOrCreateSettings(userId, opts);
  const [updated] = await db
    .update(schema.userSettings)
    .set({ ...input, revision: ifMatchRevision + 1, updatedAt: new Date() })
    .where(
      and(
        eq(schema.userSettings.userId, userId),
        eq(schema.userSettings.revision, ifMatchRevision),
      ),
    )
    .returning();
  if (!updated) {
    const existing = await getOrCreateSettings(userId, opts);
    throw new ConflictError("revision mismatch", existing);
  }
  return updated;
}
