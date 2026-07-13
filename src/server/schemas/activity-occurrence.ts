/**
 * Activity occurrence resource schemas.
 *
 * Mirrors the `activity_occurrences` table in src/server/db/schema.ts
 * (ADR-001). Materialized-or-overridden instances keyed by
 * (series_id, occurrence_key). Override columns are null when inherited from
 * the series template. Checked for drift against api/openapi.yaml in CI.
 */

import { z } from "zod";
import {
  energyLevelEnum,
  instant,
  jsonObject,
  managedRowFields,
  occurrenceStatusEnum,
  softDeletableFields,
  uuid,
} from "./common";

/** Activity occurrence response body. */
export const activityOccurrenceResponse = z.object({
  ...managedRowFields,
  ...softDeletableFields,
  userId: uuid,
  seriesId: uuid,
  /** Original local start; stable identity that survives series splits. */
  occurrenceKey: instant,
  // override columns — null = inherit from series template
  title: z.string().nullable(),
  startAt: instant.nullable(),
  durationMin: z.number().int().nullable(),
  status: occurrenceStatusEnum,
  /** Per-occurrence checklist overrides (jsonb). */
  checklistOverride: jsonObject.nullable(),
  energy: energyLevelEnum.nullable(),
  completedAt: instant.nullable(),
});

/**
 * PATCH /api/v1/activity-occurrences/{id} body. Override fields + status.
 * Null clears an override back to the series template value.
 */
export const activityOccurrencePatch = z.object({
  title: z.string().nullable().optional(),
  startAt: instant.nullable().optional(),
  durationMin: z.number().int().nullable().optional(),
  status: occurrenceStatusEnum.optional(),
  checklistOverride: jsonObject.nullable().optional(),
  energy: energyLevelEnum.nullable().optional(),
  completedAt: instant.nullable().optional(),
});

export type ActivityOccurrenceResponse = z.infer<
  typeof activityOccurrenceResponse
>;
export type ActivityOccurrencePatch = z.infer<typeof activityOccurrencePatch>;
