/**
 * API envelopes: error shape and cursor pagination.
 *
 * Mirrors the ADR-002 API contract (standard error envelope + cursor
 * pagination). Checked for drift against api/openapi.yaml in CI.
 */

import { z } from "zod";
import { jsonObject } from "./common";

/* -------------------------------------------------------------------------- */
/* Error envelope                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Standard error body returned by every non-2xx response (ADR-002).
 * `retryable` tells offline clients whether to retry (429/5xx) or surface a
 * conflict UI (4xx terminal).
 */
export const errorEnvelope = z.object({
  error: z.object({
    /** Stable machine code, e.g. "revision_conflict", "validation_failed". */
    code: z.string(),
    /** Human-readable message safe to surface to the user. */
    message: z.string(),
    /** Optional structured details (field errors, current server state, ...). */
    details: jsonObject.optional(),
    /** True for 429/5xx (client retries with backoff); false for 4xx terminal. */
    retryable: z.boolean(),
  }),
});

/* -------------------------------------------------------------------------- */
/* Cursor pagination                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Cursor-paginated list response (ADR-002 `?cursor=&limit=`). `nextCursor` is
 * null when the feed is exhausted. Pass it as `?cursor=` on the next request.
 */
export const cursorPagination = z.object({
  nextCursor: z.string().nullable(),
});

/**
 * Build a paginated list response schema around an item schema. Usage:
 *   const tagList = paginatedList(tagResponse);
 */
export function paginatedList<T extends z.ZodTypeAny>(item: T) {
  return z.object({
    items: z.array(item),
    nextCursor: z.string().nullable(),
  });
}
