/**
 * Category resource schemas.
 *
 * Mirrors the `categories` table in src/server/db/schema.ts. Six seeded
 * categories; `key` is the immutable semantic id, `label`/`sortOrder` are
 * user-editable. Checked for drift against api/openapi.yaml in CI.
 */

import { z } from "zod";
import {
  managedRowFields,
  softDeletableFields,
  uuid,
} from "./common";

/**
 * Category response body. `key` is immutable (peach/butter/mint/sky/lilac/rose).
 */
export const categoryResponse = z.object({
  ...managedRowFields,
  ...softDeletableFields,
  userId: uuid,
  /** Immutable semantic key (matches a design token). */
  key: z.string(),
  /** User-editable display label. */
  label: z.string(),
  sortOrder: z.number().int(),
});

/**
 * PATCH /api/v1/categories/{id} body. Only `label` and `sortOrder` are
 * editable — `key` is immutable and must NOT be present on updates.
 */
export const categoryUpdate = z.object({
  label: z.string().optional(),
  sortOrder: z.number().int().optional(),
});

export type CategoryResponse = z.infer<typeof categoryResponse>;
export type CategoryUpdate = z.infer<typeof categoryUpdate>;
