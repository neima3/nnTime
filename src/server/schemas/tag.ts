/**
 * Tag resource schemas.
 *
 * Mirrors the `tags` table in src/server/db/schema.ts. User-authored tags with
 * a token color name (never raw hex). Checked for drift against api/openapi.yaml
 * in CI.
 */

import { z } from "zod";
import {
  managedRowFields,
  softDeletableFields,
  uuid,
} from "./common";

/** Tag response body. */
export const tagResponse = z.object({
  ...managedRowFields,
  ...softDeletableFields,
  userId: uuid,
  name: z.string(),
  /** Design-token color name (e.g. "iris"), never raw hex. Nullable column. */
  color: z.string().nullable(),
});

/** POST /api/v1/tags body. */
export const tagCreate = z.object({
  name: z.string(),
  color: z.string().optional(),
});

/** PATCH /api/v1/tags/{id} body. */
export const tagUpdate = z.object({
  name: z.string().optional(),
  color: z.string().nullable().optional(),
});

export type TagResponse = z.infer<typeof tagResponse>;
export type TagCreate = z.infer<typeof tagCreate>;
export type TagUpdate = z.infer<typeof tagUpdate>;
