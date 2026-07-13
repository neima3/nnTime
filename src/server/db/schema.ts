/**
 * Kairo domain schema — Phase 1A.
 *
 * Binding contracts:
 *  - ADR-001 (temporal model & recurrence)
 *  - ADR-002 (API contract & offline sync protocol)
 *  - ADR-004 (focus-session state machine — schema only here; logic in 3A)
 *  - ADR-005 SEC-01 (every owned row has user_id, scoped in every query)
 *
 * Invariants enforced by schema-invariants.test.ts (run in CI):
 *  - Every user-owned table: UUIDv7 PK, `user_id`, `created_at`/`updated_at`
 *    (timestamptz), monotonic integer `revision`, `deleted_at` tombstone.
 *  - IDs are random UUIDs (public id ≠ enumeration; create via `createId()`).
 *  - Instants stored UTC (timestamptz); date-only values are DATE columns.
 *
 * `revision` is a plain integer here; ADR-002's If-Match 409 logic lives in the
 * DAL (1C). The DB does not enforce monotonicity beyond DEFAULT 1 — the service
 * layer bumps it inside the same transaction as each write.
 */

import {
  boolean,
  date,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  index,
  bigint,
  primaryKey,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/* -------------------------------------------------------------------------- */
/* Enums (closed — mirrored in api/openapi.yaml and zod)                      */
/* -------------------------------------------------------------------------- */

export const hourCycle = pgEnum("hour_cycle", ["h12", "h24"]);
export const themeMode = pgEnum("theme_mode", ["system", "light", "dark"]);
/** ADR-001: tasks.bucket ∈ {inbox, anytime}. */
export const taskBucket = pgEnum("task_bucket", ["inbox", "anytime"]);
export const energyLevel = pgEnum("energy_level", ["low", "medium", "high"]);
export const priority = pgEnum("priority", ["none", "low", "high"]);
/** ADR-001: occurrence lifecycle. */
export const occurrenceStatus = pgEnum("occurrence_status", [
  "pending",
  "completed",
  "skipped",
  "cancelled",
]);
export const checklistParent = pgEnum("checklist_parent", [
  "series",
  "task",
  "occurrence",
]);
export const activitySource = pgEnum("activity_source", [
  "manual",
  "routine",
  "calendar",
]);
/** ADR-004: focus-session state machine. */
export const focusState = pgEnum("focus_state", [
  "running",
  "paused",
  "completed",
  "skipped",
  "cancelled",
]);
/** ADR-001: planner_events history event types. */
export const plannerEventType = pgEnum("planner_event_type", [
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
/** ADR-002: change_log op for the incremental sync feed. */
export const changeOp = pgEnum("change_op", ["upsert", "delete"]);

/* -------------------------------------------------------------------------- */
/* Identity & settings                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Minimal identity row for 1A. Better Auth extends this table in 1C
 * (its own columns — password hashes, sessions, verification tokens — land in
 * separate Better Auth tables, not by mutating this shape).
 */
export const users = pgTable("users", {
  id: uuid("id").primaryKey(),
  email: text("email").notNull(),
  emailVerifiedAt: timestamp("email_verified_at", {
    withTimezone: true,
    mode: "date",
  }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
});

/**
 * ADR-001: typed columns (NOT JSON) for timezone/locale/etc. JSON only for
 * presentation extras (notification_prefs). Defaults are applied at signup (1C).
 */
export const userSettings = pgTable("user_settings", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  timezone: text("timezone").notNull(), // IANA key, validated at the service edge
  locale: text("locale").notNull().default("en"),
  weekStart: smallint("week_start").notNull().default(0), // 0=Sun … 6=Sat
  hourCycle: hourCycle("hour_cycle").notNull().default("h12"),
  theme: themeMode("theme").notNull().default("system"),
  reducedStimulation: boolean("reduced_stimulation").notNull().default(false),
  // Presentation-only extras (ADR-001 allows JSON here): per-type reminder
  // offsets, sound choices, quiet hours. Typed core settings stay above.
  notificationPrefs: jsonb("notification_prefs").notNull().default({}),
  schemaVersion: integer("schema_version").notNull().default(1),
  revision: integer("revision").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
});

/* -------------------------------------------------------------------------- */
/* Categories & tags                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Six seeded categories. `key` is the immutable semantic id (peach/butter/
 * mint/sky/lilac/rose) — matches the design tokens; the emoji picker / color
 * is token-constrained. `label` is user-editable. Delete = soft; orphaned rows
 * fall back to a canonical key (resolved in the service layer, 1C).
 */
export const categories = pgTable(
  "categories",
  {
    id: uuid("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    key: text("key").notNull(), // immutable semantic key
    label: text("label").notNull(),
    sortOrder: smallint("sort_order").notNull().default(0),
    revision: integer("revision").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
  },
  (t) => [
    uniqueIndex("categories_user_key_active_idx")
      .on(t.userId, t.key)
      .where(sql`${t.deletedAt} is null`),
    index("categories_user_idx").on(t.userId),
  ],
);

export const tags = pgTable(
  "tags",
  {
    id: uuid("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    color: text("color"), // token name, e.g. "iris" — never raw hex
    revision: integer("revision").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
  },
  (t) => [
    uniqueIndex("tags_user_name_active_idx")
      .on(t.userId, t.name)
      .where(sql`${t.deletedAt} is null`),
    index("tags_user_idx").on(t.userId),
  ],
);

/* -------------------------------------------------------------------------- */
/* Activities: series + occurrences (ADR-001)                                 */
/* -------------------------------------------------------------------------- */

/**
 * Recurrence master. One-off activities = a series with no RRULE and one
 * occurrence. `tz` + `dtstartLocal` carry wall-clock semantics; expansion
 * happens in the series zone (ADR-001). Template fields are copied onto
 * materialized occurrences unless overridden.
 */
export const activitySeries = pgTable(
  "activity_series",
  {
    id: uuid("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tz: text("tz").notNull(), // IANA zone for wall-clock expansion
    dtstartLocal: timestamp("dtstart_local", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    rrule: text("rrule"), // null = one-off
    exdate: date("exdate", { mode: "date" }).array(),
    rdate: timestamp("rdate", { withTimezone: true, mode: "date" }).array(),
    // template fields
    title: text("title").notNull(),
    emoji: text("emoji"),
    categoryId: uuid("category_id"),
    durationMin: integer("duration_min").notNull(),
    checklistTemplate: jsonb("checklist_template").notNull().default([]),
    energy: energyLevel("energy"),
    priority: priority("priority").notNull().default("none"),
    tags: uuid("tags").array(),
    notes: text("notes"),
    source: activitySource("source").notNull().default("manual"),
    sourceRef: text("source_ref"), // routine_id / calendar provider id
    // sync & lifecycle
    revision: integer("revision").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
  },
  (t) => [index("activity_series_user_idx").on(t.userId)],
);

/**
 * Materialized-or-overridden instances keyed by `(series_id, occurrence_key)`
 * where occurrence_key = the original local start (stable identity that
 * survives series splits — ADR-001 "this and future"). Rows exist when an
 * occurrence is overridden, completed, skipped, cancelled, or within the
 * materialization horizon; otherwise occurrences expand virtually for display.
 */
export const activityOccurrences = pgTable(
  "activity_occurrences",
  {
    id: uuid("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    seriesId: uuid("series_id")
      .notNull()
      .references(() => activitySeries.id, { onDelete: "cascade" }),
    occurrenceKey: timestamp("occurrence_key", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    // override columns (null = inherit from series template)
    title: text("title"),
    startAt: timestamp("start_at", { withTimezone: true, mode: "date" }),
    durationMin: integer("duration_min"),
    status: occurrenceStatus("status").notNull().default("pending"),
    checklistOverride: jsonb("checklist_override"),
    energy: energyLevel("energy"),
    completedAt: timestamp("completed_at", {
      withTimezone: true,
      mode: "date",
    }),
    revision: integer("revision").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
  },
  (t) => [
    uniqueIndex("occurrences_series_key_idx").on(t.seriesId, t.occurrenceKey),
    index("occurrences_user_start_idx").on(t.userId, t.startAt),
  ],
);

/* -------------------------------------------------------------------------- */
/* Tasks: two buckets, one table (ADR-001)                                    */
/* -------------------------------------------------------------------------- */

/**
 * `inbox` = brain-dump To-do (no day attachment). `anytime` = attached to a
 * `date` with no time. "Schedule" converts a task to an activity series: the
 * task is soft-deleted with `convertedTo` pointing at the new series;
 * checklist + history transfer; identity recorded in planner_events.
 */
export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    bucket: taskBucket("bucket").notNull(),
    title: text("title").notNull(),
    emoji: text("emoji"),
    categoryId: uuid("category_id"),
    date: date("date", { mode: "date" }), // null for inbox
    priority: priority("priority").notNull().default("none"),
    energy: energyLevel("energy"),
    notes: text("notes"),
    convertedTo: uuid("converted_to"), // → activity_series on schedule
    revision: integer("revision").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
  },
  (t) => [index("tasks_user_bucket_date_idx").on(t.userId, t.bucket, t.date)],
);

/* -------------------------------------------------------------------------- */
/* Checklist items (shared across series/task/occurrence)                     */
/* -------------------------------------------------------------------------- */

export const checklistItems = pgTable(
  "checklist_items",
  {
    id: uuid("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    parentType: checklistParent("parent_type").notNull(),
    parentId: uuid("parent_id").notNull(),
    label: text("label").notNull(),
    sortOrder: smallint("sort_order").notNull().default(0),
    done: boolean("done").notNull().default(false),
    revision: integer("revision").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
  },
  (t) => [index("checklist_parent_idx").on(t.parentType, t.parentId)],
);

/* -------------------------------------------------------------------------- */
/* Routines (ADR-001; materializer logic in Phase 2B)                         */
/* -------------------------------------------------------------------------- */

export const routines = pgTable("routines", {
  id: uuid("id").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  emoji: text("emoji"),
  categoryId: uuid("category_id"),
  notes: text("notes"),
  revision: integer("revision").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
});

export const routineSteps = pgTable(
  "routine_steps",
  {
    id: uuid("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    routineId: uuid("routine_id")
      .notNull()
      .references(() => routines.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    durationMin: integer("duration_min"),
    sortOrder: smallint("sort_order").notNull().default(0),
    revision: integer("revision").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
  },
  (t) => [index("routine_steps_routine_idx").on(t.routineId)],
);

/**
 * Carries the recurrence + `paused` + `nextRunAt`. Phase 2B's materializer is a
 * durable job (ADR-004) that dedupes on `(routine_schedule_id, occurrence_key)`.
 */
export const routineSchedules = pgTable(
  "routine_schedules",
  {
    id: uuid("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    routineId: uuid("routine_id")
      .notNull()
      .references(() => routines.id, { onDelete: "cascade" }),
    tz: text("tz").notNull(),
    rrule: text("rrule"),
    paused: boolean("paused").notNull().default(false),
    nextRunAt: timestamp("next_run_at", {
      withTimezone: true,
      mode: "date",
    }),
    revision: integer("revision").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
  },
  (t) => [index("routine_schedules_next_run_idx").on(t.nextRunAt)],
);

/* -------------------------------------------------------------------------- */
/* Focus sessions (ADR-004 — schema only this phase; logic in 3A)             */
/* -------------------------------------------------------------------------- */

/**
 * Partial unique index below enforces "one active session per user" — exactly
 * one row per user may be in (running, paused). ADR-004.
 */
export const focusSessions = pgTable(
  "focus_sessions",
  {
    id: uuid("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    activityOccurrenceId: uuid("activity_occurrence_id"), // nullable for ad-hoc
    state: focusState("state").notNull().default("running"),
    startedAt: timestamp("started_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    targetDurationMin: integer("target_duration_min").notNull(),
    accumulatedPauseSec: integer("accumulated_pause_sec").notNull().default(0),
    currentIntervalStartedAt: timestamp("current_interval_started_at", {
      withTimezone: true,
      mode: "date",
    }),
    revision: integer("revision").notNull().default(1),
    completionReason: text("completion_reason"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // ADR-004: at most one running-or-paused session per user.
    uniqueIndex("focus_sessions_one_active_per_user_idx")
      .on(t.userId)
      .where(sql`${t.state} in ('running', 'paused')`),
    index("focus_sessions_user_idx").on(t.userId),
  ],
);

/* -------------------------------------------------------------------------- */
/* Push subscriptions (schema only; Web Push in Phase 3B)                     */
/* -------------------------------------------------------------------------- */

/** Endpoint is a secret (SEC-08): never logged, never returned unscoped. */
export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: uuid("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull(),
    keys: jsonb("keys").notNull(),
    revision: integer("revision").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
  },
  (t) => [
    uniqueIndex("push_subs_user_endpoint_idx").on(t.userId, t.endpoint),
    index("push_subs_user_idx").on(t.userId),
  ],
);

/* -------------------------------------------------------------------------- */
/* Append-only history (ADR-001) — stats & streaks read ONLY this             */
/* -------------------------------------------------------------------------- */

export const plannerEvents = pgTable(
  "planner_events",
  {
    id: uuid("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    eventType: plannerEventType("event_type").notNull(),
    payload: jsonb("payload").notNull().default({}),
    occurredAt: timestamp("occurred_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    tz: text("tz").notNull(),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "date",
    })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("planner_events_user_occurred_idx").on(t.userId, t.occurredAt)],
);

/* -------------------------------------------------------------------------- */
/* Sync infrastructure (ADR-002 — "from day one")                              */
/* -------------------------------------------------------------------------- */

/**
 * Idempotency-Key replay store. Client-generated UUID per logical mutation;
 * server stores the response and replays it on retry. 48h TTL.
 */
export const idempotencyKeys = pgTable(
  "idempotency_keys",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    key: text("key").notNull(), // client-supplied UUID
    requestMethod: text("request_method").notNull(),
    requestPath: text("request_path").notNull(),
    responseStatus: integer("response_status").notNull(),
    responseBody: jsonb("response_body"),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "date",
    })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp("expires_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.key] })],
);

/**
 * Incremental sync feed. `id` is a per-user change sequence (the cursor is the
 * last id seen). Tombstones surface here as op='delete'. `GET /changes?cursor=`
 * reads this ordered by id within the user.
 */
export const changeLog = pgTable(
  "change_log",
  {
    id: bigint("id", { mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    op: changeOp("op").notNull(),
    revision: integer("revision").notNull(),
    occurredAt: timestamp("occurred_at", {
      withTimezone: true,
      mode: "date",
    })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("change_log_user_id_idx").on(t.userId, t.id)],
);

/**
 * Rate-limit counter buckets (SEC-06). One row per (bucket key) with a
 * sliding window count. `bucket` identifies the limit scope, e.g.
 * "signup:ip:1.2.3.4" or "login:account:user@x.com".
 */
export const rateLimitBuckets = pgTable(
  "rate_limit_buckets",
  {
    bucket: text("bucket").primaryKey(),
    count: integer("count").notNull().default(0),
    windowStart: timestamp("window_start", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    updatedAt: timestamp("updated_at", {
      withTimezone: true,
      mode: "date",
    })
      .notNull()
      .defaultNow(),
  },
);

/* -------------------------------------------------------------------------- */
/* Exports for the DAL / tests                                                */
/* -------------------------------------------------------------------------- */

export type DbUser = typeof users.$inferSelect;
export type DbUserSettings = typeof userSettings.$inferSelect;
export type DbCategory = typeof categories.$inferSelect;
export type DbTag = typeof tags.$inferSelect;
export type DbActivitySeries = typeof activitySeries.$inferSelect;
export type DbActivityOccurrence = typeof activityOccurrences.$inferSelect;
export type DbTask = typeof tasks.$inferSelect;
export type DbChecklistItem = typeof checklistItems.$inferSelect;
export type DbRoutine = typeof routines.$inferSelect;
export type DbRoutineStep = typeof routineSteps.$inferSelect;
export type DbRoutineSchedule = typeof routineSchedules.$inferSelect;
export type DbFocusSession = typeof focusSessions.$inferSelect;
export type DbPushSubscription = typeof pushSubscriptions.$inferSelect;
export type DbPlannerEvent = typeof plannerEvents.$inferSelect;

/** All user-owned tables, for invariant checks (schema-invariants.test.ts). */
export const userOwnedTables = {
  user_settings: userSettings,
  categories,
  tags,
  activity_series: activitySeries,
  activity_occurrences: activityOccurrences,
  tasks,
  checklist_items: checklistItems,
  routines,
  routine_steps: routineSteps,
  routine_schedules: routineSchedules,
  focus_sessions: focusSessions,
  push_subscriptions: pushSubscriptions,
  planner_events: plannerEvents,
} as const;
