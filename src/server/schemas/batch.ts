/**
 * Batch endpoint schemas.
 *
 * Mirrors the ADR-002 batch contract: POST /api/v1/batch takes an ordered list
 * of operations and returns an ordered list of results, each independently
 * retryable/terminal (not all-or-nothing). Checked for drift against
 * api/openapi.yaml in CI.
 */

import { z } from "zod";

/** HTTP methods allowed inside a batch operation. */
const batchMethod = z.enum(["POST", "PATCH", "DELETE"]);

/**
 * One operation in a batch request. `body` is opaque here — the per-route
 * zod schema validates it when the operation is dispatched.
 */
export const batchOp = z.object({
  method: batchMethod,
  /** Path beginning at /api/v1/... (server resolves relative to the API root). */
  path: z.string(),
  /** Optional body for POST/PATCH; validated against the target route's schema. */
  body: z.unknown().optional(),
  /**
   * Optional Idempotency-Key scoped to this single operation (ADR-002): the
   * server replays the stored response on retry within the 48h window.
   */
  idempotencyKey: z.string().optional(),
});

/** POST /api/v1/batch request body. */
export const batchRequest = z.object({
  operations: z.array(batchOp),
});

/** One result, positionally aligned with the request operations array. */
export const batchResult = z.object({
  /** HTTP status for this individual operation (e.g. 200, 409, 422). */
  status: z.number().int(),
  /** Response body for this operation (opaque — shaped by the target route). */
  body: z.unknown(),
});

/** POST /api/v1/batch response body. Ordered, 1:1 with the request operations. */
export const batchResponse = z.object({
  results: z.array(batchResult),
});

export type BatchOp = z.infer<typeof batchOp>;
export type BatchRequest = z.infer<typeof batchRequest>;
export type BatchResult = z.infer<typeof batchResult>;
export type BatchResponse = z.infer<typeof batchResponse>;
