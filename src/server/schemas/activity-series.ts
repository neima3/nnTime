/**
 * Activity series resource schemas.
 *
 * Mirrors the `activity_series` table in src/server/db/schema.ts (ADR-001
 * recurrence master). One-off activities are a series with no RRULE and one
 * occurrence. `tz` + `dtstartLocal` carry wall-clock semantics; expansion
 * happens in the series zone. Template fields are copied onto materialized
 * occurrences unless overridden. Checked for drift against api/openapi.yaml in CI.
 */

import { z } from "zod";
import {
  activitySourceEnum,
  dateStr,
  editScopeEnum,
  energyLevelEnum,
  ianaTimezone,
  instant,
  jsonObject,
  managedRowFields,
  priorityEnum,
  softDeletableFields,
  uuid,
} from "./common";

/**
 * Checklist template entry stored as `checklist_template` jsonb on the series.
 * Free-form object; exact inner shape is application-defined per ADR-001.
 */
const checklistTemplate = z.array(jsonObject);

/** Activity series response body. */
export const activitySeriesResponse = z.object({
  ...managedRowFields,
  ...softDeletableFields,
  userId: uuid,
  /** IANA zone for wall-clock expansion (ADR-001). */
  tz: ianaTimezone,
  /** Wall-clock-aware start instant (stored timestamptz). */
  dtstartLocal: instant,
  /** RRULE string; null = one-off activity. */
  rrule: z.string().nullable(),
  /** EXDATE list (date-only values, ADR-001). */
  exdate: z.array(dateStr).nullable(),
  /** RDATE list (instants). */
  rdate: z.array(instant).nullable(),
  // template fields
  title: z.string(),
  emoji: z.string().nullable(),
  categoryId: uuid.nullable(),
  durationMin: z.number().int(),
  checklistTemplate,
  energy: energyLevelEnum.nullable(),
  priority: priorityEnum,
  /** Tag ids referenced by this series. */
  tags: z.array(uuid).nullable(),
  notes: z.string().nullable(),
  source: activitySourceEnum,
  /** routine_id / calendar provider id when source != manual. */
  sourceRef: z.string().nullable(),
});

/** POST /api/v1/activity-series body. */
export const activitySeriesCreate = z.object({
  tz: ianaTimezone,
  /** Local wall-clock start instant (stored timestamptz). */
  dtstartLocal: instant,
  rrule: z.string().nullable().optional(),
  exdate: z.array(dateStr).optional(),
  rdate: z.array(instant).optional(),
  title: z.string(),
  emoji: z.string().optional(),
  categoryId: uuid.optional(),
  durationMin: z.number().int(),
  checklistTemplate: checklistTemplate.optional(),
  energy: energyLevelEnum.nullish(),
  priority: priorityEnum.optional(),
  tags: z.array(uuid).optional(),
  notes: z.string().optional(),
  source: activitySourceEnum.optional(),
  sourceRef: z.string().optional(),
});

/**
 * PATCH /api/v1/activity-series/{id} body. Carries `editScope` (ADR-001):
 *  - this             → patch a single occurrence (delegated to occurrences)
 *  - this_and_future  → split the series at the selected occurrence
 *  - all              → update the master
 */
export const activitySeriesUpdate = z.object({
  /** ADR-001 edit scope; defaults to `all` for one-off / master updates. */
  editScope: editScopeEnum.optional(),
  /**
   * Occurrence identity for `this` / `this_and_future`. Optional for `all`
   * (server falls back to the series dtstartLocal).
   */
  occurrenceKey: instant.optional(),
  tz: ianaTimezone.optional(),
  dtstartLocal: instant.optional(),
  rrule: z.string().nullable().optional(),
  exdate: z.array(dateStr).nullable().optional(),
  rdate: z.array(instant).nullable().optional(),
  title: z.string().optional(),
  emoji: z.string().nullable().optional(),
  categoryId: uuid.nullable().optional(),
  durationMin: z.number().int().optional(),
  checklistTemplate: checklistTemplate.optional(),
  energy: energyLevelEnum.nullable().optional(),
  priority: priorityEnum.optional(),
  tags: z.array(uuid).nullable().optional(),
  notes: z.string().nullable().optional(),
  source: activitySourceEnum.optional(),
  sourceRef: z.string().nullable().optional(),
  /** Occurrence-only fields (editScope=this). */
  status: z.enum(["pending", "completed", "skipped", "cancelled"]).optional(),
  startAt: instant.optional(),
  completedAt: instant.nullable().optional(),
  /** Per-occurrence checklist (editScope=this); does not rewrite series template. */
  checklistOverride: z
    .array(z.object({ label: z.string(), done: z.boolean().optional() }))
    .nullable()
    .optional(),
});

export type ActivitySeriesResponse = z.infer<typeof activitySeriesResponse>;
export type ActivitySeriesCreate = z.infer<typeof activitySeriesCreate>;
export type ActivitySeriesUpdate = z.infer<typeof activitySeriesUpdate>;
