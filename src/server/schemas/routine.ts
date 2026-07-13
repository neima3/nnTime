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

/** POST /api/v1/routines body. */
export const routineCreate = z.object({
  title: z.string(),
  emoji: z.string().optional(),
  categoryId: uuid.optional(),
  notes: z.string().optional(),
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
  durationMin: z.number().int().nullable(),
  sortOrder: z.number().int(),
});

/** POST body for a routine step. */
export const routineStepCreate = z.object({
  routineId: uuid,
  title: z.string(),
  durationMin: z.number().int().nullish(),
  sortOrder: z.number().int().optional(),
});

/** PATCH body for a routine step. */
export const routineStepUpdate = z.object({
  title: z.string().optional(),
  durationMin: z.number().int().nullable().optional(),
  sortOrder: z.number().int().optional(),
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
  routineId: uuid,
  tz: ianaTimezone,
  rrule: z.string().nullable().optional(),
  paused: z.boolean().optional(),
  nextRunAt: instant.nullish(),
});

/** PATCH body for a routine schedule. */
export const routineScheduleUpdate = z.object({
  tz: ianaTimezone.optional(),
  rrule: z.string().nullable().optional(),
  paused: z.boolean().optional(),
  nextRunAt: instant.nullable().optional(),
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
