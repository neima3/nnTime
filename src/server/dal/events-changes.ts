/**
 * Planner events (ADR-001 history) + change-log reads (ADR-002 sync).
 *
 * `appendChangeLog` lives in `./change-log` (every resource module writes to
 * it) and is re-exported here so the events/changes surface stays in one place.
 */
import "server-only";
import dbDefault from "../db";
import * as schema from "../db/schema";
import { sql } from "drizzle-orm";
import type { Db } from "./types";
import { getOrCreateSettings } from "./tags-categories-settings";

export { appendChangeLog } from "./change-log";

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
  let checkpointCursor = lastItem ? String(lastItem.id) : null;
  if (!checkpointCursor) {
    const checkpointRows = await db.execute(
      sql`SELECT COALESCE(MAX(id), 0) AS checkpoint_cursor FROM change_log WHERE user_id = ${userId}`,
    );
    const checkpoint = (
      (checkpointRows as unknown as Record<string, unknown>[]) ?? []
    )[0]?.checkpoint_cursor;
    checkpointCursor = String(checkpoint ?? 0);
  }
  return { items, nextCursor, checkpointCursor };
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
