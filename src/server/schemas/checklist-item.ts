/**
 * Checklist item resource schemas.
 *
 * Mirrors the `checklist_items` table in src/server/db/schema.ts. Shared
 * across series/task/occurrence parents via `parentType` + `parentId`.
 * Checked for drift against api/openapi.yaml in CI.
 */

import { z } from "zod";
import {
  checklistParentEnum,
  managedRowFields,
  softDeletableFields,
  uuid,
} from "./common";

/** Checklist item response body. */
export const checklistItemResponse = z.object({
  ...managedRowFields,
  ...softDeletableFields,
  userId: uuid,
  /** series | task | occurrence. */
  parentType: checklistParentEnum,
  parentId: uuid,
  label: z.string(),
  sortOrder: z.number().int(),
  done: z.boolean(),
});

/** POST /api/v1/checklist-items body. */
export const checklistItemCreate = z.object({
  parentType: checklistParentEnum,
  parentId: uuid,
  label: z.string(),
  sortOrder: z.number().int().optional(),
  done: z.boolean().optional(),
});

/** PATCH /api/v1/checklist-items/{id} body. */
export const checklistItemUpdate = z.object({
  label: z.string().optional(),
  sortOrder: z.number().int().optional(),
  done: z.boolean().optional(),
});

export type ChecklistItemResponse = z.infer<typeof checklistItemResponse>;
export type ChecklistItemCreate = z.infer<typeof checklistItemCreate>;
export type ChecklistItemUpdate = z.infer<typeof checklistItemUpdate>;
