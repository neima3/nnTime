/**
 * Search schemas (H3).
 *
 * GET /api/v1/search?q= returns ranked matches across the caller's activity
 * series and tasks. Series — not expanded occurrences — are the unit, so a
 * recurring block matches once and carries `repeats`.
 *
 * Matching/ranking rules live in src/lib/search.ts (pure, unit-tested); this
 * file is the wire contract, checked for drift against api/openapi.yaml in CI.
 */

import { z } from "zod";
import { dateStr, uuid } from "./common";

/** Which store a hit came from. */
export const searchKindEnum = z.enum(["activity", "task"]);

/** Which field produced the match — the client labels note matches. */
export const searchMatchedOnEnum = z.enum(["title", "notes"]);

/** One ranked hit. */
export const searchHit = z.object({
  id: uuid,
  kind: searchKindEnum,
  title: z.string(),
  emoji: z.string().nullable(),
  /** Anchor date; null for inbox tasks, which have no date. */
  date: dateStr.nullable(),
  /** Minutes from midnight for scheduled activities; null for tasks. */
  startMin: z.number().int().min(0).max(1439).nullable(),
  categoryId: uuid.nullable(),
  matchedOn: searchMatchedOnEnum,
  /** True when the matched activity series has an RRULE. */
  repeats: z.boolean(),
});

/** GET /api/v1/search response body. */
export const searchResponse = z.object({
  /** The normalized query that produced these hits. */
  query: z.string(),
  /** Today in the user's planning zone — clients label dates against this. */
  today: dateStr,
  /** The planning zone used to resolve `today` and each anchor date. */
  zone: z.string(),
  items: z.array(searchHit),
  /** Always null for now — search is capped, not paginated. */
  nextCursor: z.null(),
});

export type SearchHitResponse = z.infer<typeof searchHit>;
export type SearchResponseBody = z.infer<typeof searchResponse>;
