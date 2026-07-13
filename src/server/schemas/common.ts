/**
 * Shared primitive schemas and closed enums for the Kairo REST API.
 *
 * Mirrors `src/server/db/schema.ts` (the pgEnum definitions and column types).
 * The OpenAPI spec (api/openapi.yaml) is checked for drift against these in CI.
 *
 * Binding contracts:
 *  - ADR-001 (temporal model: RFC 3339 UTC instants, date-only values, IANA tz)
 *  - ADR-002 (API contract: UUIDv7 ids, closed enums)
 *
 * DO NOT regenerate via drizzle-zod — these are hand-written to match the
 * hand-written OpenAPI spec exactly. Any field/type change here must be made in
 * schema.ts, this file, and api/openapi.yaml together.
 */

import { z } from "zod";

/* -------------------------------------------------------------------------- */
/* Primitives                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * UUID. Kairo uses UUIDv7 (time-ordered) for all primary keys per ADR-002; the
 * format is still RFC 4122 so the generic UUID check applies.
 */
export const uuid = z.uuid();

/**
 * RFC 3339 UTC instant (e.g. `2026-07-13T10:00:00Z`). All `timestamptz`
 * columns serialize as UTC `date-time` per ADR-001/ADR-002.
 */
export const instant = z.iso.datetime();

/**
 * Calendar date `YYYY-MM-DD`. Used for Anytime day attachment and all-day
 * values per ADR-001 — never midnight-UTC timestamps.
 */
export const dateStr = z.iso.date();

/**
 * IANA timezone key (e.g. `America/Los_Angeles`). Validated as a non-empty
 * string at the API edge; full IANA membership check happens in the service
 * layer to avoid bundling the timezone database into the schema.
 */
export const ianaTimezone = z.string().min(1);

/**
 * Monotonic per-row revision used for optimistic concurrency (If-Match / 409,
 * ADR-002). Defaults to 1 on insert and is bumped inside each write tx.
 */
export const revision = z.number().int().min(1);

/**
 * Free-form JSON object for `jsonb` columns that carry presentation extras
 * (e.g. notification_prefs, planner_events.payload).
 */
export const jsonObject = z.record(z.string(), z.unknown());

/* -------------------------------------------------------------------------- */
/* Enums (closed — must match pgEnum definitions in schema.ts exactly)        */
/* -------------------------------------------------------------------------- */

/** hour_cycle: h12 | h24 */
export const hourCycleEnum = z.enum(["h12", "h24"]);

/** theme_mode: system | light | dark */
export const themeModeEnum = z.enum(["system", "light", "dark"]);

/** ADR-001 task_bucket: inbox | anytime */
export const taskBucketEnum = z.enum(["inbox", "anytime"]);

/** energy_level: low | medium | high */
export const energyLevelEnum = z.enum(["low", "medium", "high"]);

/** priority: none | low | high */
export const priorityEnum = z.enum(["none", "low", "high"]);

/** ADR-001 occurrence_status: pending | completed | skipped | cancelled */
export const occurrenceStatusEnum = z.enum([
  "pending",
  "completed",
  "skipped",
  "cancelled",
]);

/** checklist_parent: series | task | occurrence */
export const checklistParentEnum = z.enum(["series", "task", "occurrence"]);

/** activity_source: manual | routine | calendar */
export const activitySourceEnum = z.enum(["manual", "routine", "calendar"]);

/** ADR-004 focus_state: running | paused | completed | skipped | cancelled */
export const focusStateEnum = z.enum([
  "running",
  "paused",
  "completed",
  "skipped",
  "cancelled",
]);

/** ADR-001 planner_event_type */
export const plannerEventTypeEnum = z.enum([
  "complete",
  "uncomplete",
  "skip",
  "reschedule",
  "focus_start",
  "focus_stop",
  "energy_change",
  "mood_checkin",
  "carryover",
]);

/** ADR-002 change_log op for the incremental sync feed. */
export const changeOpEnum = z.enum(["upsert", "delete"]);

/**
 * ADR-001 edit scope for activity-series mutations:
 *  - this            → patch the occurrence row
 *  - this_and_future → split the series at the occurrence
 *  - all             → update the master
 */
export const editScopeEnum = z.enum(["this", "this_and_future", "all"]);

/**
 * Day-of-week start: 0=Sun … 6=Sat (smallint column). Not a string enum in the
 * DB; modeled as an integer range here.
 */
export const weekStartEnum = z.number().int().min(0).max(6);

/* -------------------------------------------------------------------------- */
/* Shared field groups                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Fields present on every user-owned row (ADR-002: UUIDv7 PK, monotonic
 * revision, created/updated timestamps; deletedAt is an optional tombstone).
 * Tables without deletedAt (focus_sessions, planner_events) omit it.
 */
export const managedRowFields = {
  id: uuid,
  revision,
  createdAt: instant,
  updatedAt: instant,
} as const;

export const softDeletableFields = {
  /** Tombstone timestamp; absent on live rows (ADR-002 deletes are tombstones). */
  deletedAt: instant.nullish(),
} as const;
