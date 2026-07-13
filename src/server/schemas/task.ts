/**
 * Task resource schemas.
 *
 * Mirrors the `tasks` table in src/server/db/schema.ts (ADR-001: two buckets,
 * one table). `inbox` = no day attachment; `anytime` = attached to a `date`.
 * "Schedule" converts a task to an activity series via `convertedTo`.
 * Checked for drift against api/openapi.yaml in CI.
 */

import { z } from "zod";
import {
  dateStr,
  energyLevelEnum,
  managedRowFields,
  priorityEnum,
  softDeletableFields,
  taskBucketEnum,
  uuid,
} from "./common";

/** Task response body. */
export const taskResponse = z.object({
  ...managedRowFields,
  ...softDeletableFields,
  userId: uuid,
  /** ADR-001: inbox (no date) | anytime (attached to a date). */
  bucket: taskBucketEnum,
  title: z.string(),
  emoji: z.string().nullable(),
  categoryId: uuid.nullable(),
  /** Null for inbox tasks; YYYY-MM-DD for anytime tasks. */
  date: dateStr.nullable(),
  priority: priorityEnum,
  energy: energyLevelEnum.nullable(),
  notes: z.string().nullable(),
  /** Set when the task was scheduled into an activity_series. */
  convertedTo: uuid.nullable(),
});

/** POST /api/v1/tasks body. */
export const taskCreate = z.object({
  bucket: taskBucketEnum,
  title: z.string(),
  emoji: z.string().optional(),
  categoryId: uuid.optional(),
  /** Required for `anytime` bucket; must be null/absent for `inbox`. */
  date: dateStr.nullish(),
  priority: priorityEnum.optional(),
  energy: energyLevelEnum.nullish(),
  notes: z.string().optional(),
});

/** PATCH /api/v1/tasks/{id} body. */
export const taskUpdate = z.object({
  bucket: taskBucketEnum.optional(),
  title: z.string().optional(),
  emoji: z.string().nullable().optional(),
  categoryId: uuid.nullable().optional(),
  date: dateStr.nullable().optional(),
  priority: priorityEnum.optional(),
  energy: energyLevelEnum.nullable().optional(),
  notes: z.string().nullable().optional(),
});

export type TaskResponse = z.infer<typeof taskResponse>;
export type TaskCreate = z.infer<typeof taskCreate>;
export type TaskUpdate = z.infer<typeof taskUpdate>;
