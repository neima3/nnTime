/**
 * Changes feed schemas (incremental sync).
 *
 * Mirrors the `change_log` table in src/server/db/schema.ts and the ADR-002
 * incremental sync contract: GET /api/v1/changes?cursor= returns rows (including
 * tombstones) ordered by a per-user change sequence + next cursor. The cursor
 * is the last id seen. Day snapshots are for rendering, not sync.
 * Checked for drift against api/openapi.yaml in CI.
 */

import { z } from "zod";
import { changeOpEnum, instant, revision, uuid } from "./common";

/**
 * One change_log row. `id` is a per-user bigint change sequence surfaced as a
 * string (JSON has no 53-bit-safe integer) — the cursor is the last id seen.
 */
export const changeLogEntry = z.object({
  /** Per-user change sequence (bigint serialized as a decimal string). */
  id: z.string(),
  userId: uuid,
  /** Free-text entity type (e.g. "task", "activity_series"). */
  entityType: z.string(),
  entityId: uuid,
  /** upsert | delete (tombstones surface as delete). */
  op: changeOpEnum,
  /** Row revision at the time of this change. */
  revision,
  occurredAt: instant,
});

/** GET /api/v1/changes response body (cursor-paginated). */
export const changesResponse = z.object({
  items: z.array(changeLogEntry),
  /** Null when the feed is exhausted; pass back as ?cursor= otherwise. */
  nextCursor: z.string().nullable(),
});

export type ChangeLogEntry = z.infer<typeof changeLogEntry>;
export type ChangesResponse = z.infer<typeof changesResponse>;
