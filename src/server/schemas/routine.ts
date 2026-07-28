/**
 * Routine resource schemas — routines, their steps, and their schedules.
 *
 * Mirrors the `routines`, `routine_steps`, and `routine_schedules` tables in
 * src/server/db/schema.ts (ADR-001; materializer logic in Phase 2B). Schedules
 * carry recurrence + `paused` + `nextRunAt`. Checked for drift against
 * api/openapi.yaml in CI.
 */

import { z } from "zod";
import {
  ianaTimezone,
  instant,
  managedRowFields,
  pgInteger,
  pgSmallint,
  softDeletableFields,
  uuid,
} from "./common";

/* -------------------------------------------------------------------------- */
/* Routine                                                                    */
/* -------------------------------------------------------------------------- */

/** Routine response body. */
export const routineResponse = z.object({
  ...managedRowFields,
  ...softDeletableFields,
  userId: uuid,
  title: z.string(),
  emoji: z.string().nullable(),
  categoryId: uuid.nullable(),
  notes: z.string().nullable(),
});

/** PATCH /api/v1/routines/{id} body. */
export const routineUpdate = z.object({
  title: z.string().optional(),
  emoji: z.string().nullable().optional(),
  categoryId: uuid.nullable().optional(),
  notes: z.string().nullable().optional(),
});

/* -------------------------------------------------------------------------- */
/* Routine step                                                               */
/* -------------------------------------------------------------------------- */

/** Routine step response body. */
export const routineStepResponse = z.object({
  ...managedRowFields,
  ...softDeletableFields,
  userId: uuid,
  routineId: uuid,
  title: z.string(),
  /** Optional per-step duration in minutes. */
  durationMin: pgInteger.nullable(),
  sortOrder: pgSmallint,
});

/** POST body for a routine step. */
export const routineStepCreate = z.object({
  title: z.string(),
  durationMin: pgInteger.nullish(),
  sortOrder: pgSmallint.optional(),
});

/** PATCH body for a routine step. */
export const routineStepUpdate = z.object({
  title: z.string().optional(),
  durationMin: pgInteger.nullable().optional(),
  sortOrder: pgSmallint.optional(),
});

/* -------------------------------------------------------------------------- */
/* Routine schedule                                                           */
/* -------------------------------------------------------------------------- */

/** Routine schedule response body. */
export const routineScheduleResponse = z.object({
  ...managedRowFields,
  ...softDeletableFields,
  userId: uuid,
  routineId: uuid,
  /** IANA zone for wall-clock expansion (ADR-001). */
  tz: ianaTimezone,
  /** RRULE string; null = unscheduled / one-off. */
  rrule: z.string().nullable(),
  paused: z.boolean(),
  /** Next materialization instant (null when paused / no future runs). */
  nextRunAt: instant.nullable(),
});

/** POST body for a routine schedule. */
export const routineScheduleCreate = z.object({
  tz: ianaTimezone,
  rrule: z.string().nullable().optional(),
  paused: z.boolean().optional(),
});

/** PATCH body for a routine schedule. */
export const routineScheduleUpdate = z.object({
  tz: ianaTimezone.optional(),
  rrule: z.string().nullable().optional(),
  paused: z.boolean().optional(),
  nextRunAt: instant.nullable().optional(),
});

/* -------------------------------------------------------------------------- */
/* Routine API read/write models                                              */
/* -------------------------------------------------------------------------- */

/**
 * POST /api/v1/routines body. A routine may be created atomically with its
 * initial steps and one schedule. Path/server-owned fields are injected by
 * the route and DAL, never accepted from clients.
 */
export const routineCreate = z.object({
  title: z.string().min(1).max(200),
  emoji: z.string().optional(),
  categoryId: uuid.optional(),
  notes: z.string().optional(),
  steps: z
    .array(routineStepCreate.omit({ sortOrder: true }))
    .optional(),
  schedule: routineScheduleCreate.optional(),
});

/** GET /api/v1/routines/{id} response, including its child rows. */
export const routineDetailResponse = routineResponse.extend({
  steps: z.array(routineStepResponse),
  schedules: z.array(routineScheduleResponse),
});

/** GET /api/v1/routines list item, including UI summary counts. */
export const routineListItemResponse = routineDetailResponse.extend({
  stepCount: z.number().int().min(0).max(4_294_967_295),
  totalMin: z.number().int(),
});

export type RoutineResponse = z.infer<typeof routineResponse>;
export type RoutineCreate = z.infer<typeof routineCreate>;
export type RoutineUpdate = z.infer<typeof routineUpdate>;
export type RoutineStepResponse = z.infer<typeof routineStepResponse>;
export type RoutineStepCreate = z.infer<typeof routineStepCreate>;
export type RoutineStepUpdate = z.infer<typeof routineStepUpdate>;
export type RoutineScheduleResponse = z.infer<typeof routineScheduleResponse>;
export type RoutineScheduleCreate = z.infer<typeof routineScheduleCreate>;
export type RoutineScheduleUpdate = z.infer<typeof routineScheduleUpdate>;
export type RoutineDetailResponse = z.infer<typeof routineDetailResponse>;
export type RoutineListItemResponse = z.infer<typeof routineListItemResponse>;
