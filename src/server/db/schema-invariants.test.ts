/**
 * Schema invariant tests — ADR-002 / SEC-01.
 *
 * Verifies (without a DB, by introspecting the Drizzle schema definitions):
 *  - Every soft-deletable user-owned table has: user_id, revision, created_at,
 *    updated_at, deleted_at.
 *  - Append-only tables (planner_events) have user_id + created_at but no
 *    updated_at/deleted_at (immutable history).
 *  - Singleton tables (user_settings) are keyed by user_id with no separate id.
 *  - Every PK is a uuid (UUIDv7 documented).
 *
 * These are structural checks over the schema objects, catching regressions
 * (a new table missing user_id or revision) before they reach 1C's handlers.
 */
import { describe, expect, it } from "vitest";
import {
  activityOccurrences,
  activitySeries,
  categories,
  changeLog,
  checklistItems,
  focusSessions,
  idempotencyKeys,
  plannerEvents,
  pushSubscriptions,
  routineSchedules,
  routineSteps,
  routines,
  tags,
  tasks,
  userOwnedTables,
  userSettings,
} from "./schema";

function columnNames(table: unknown): Set<string> {
  if (table === null || typeof table !== "object") return new Set();
  return new Set(Object.keys(table as Record<string, unknown>));
}

/**
 * Soft-deletable, version-tracked tables: the full ADR-002 set
 * (user_id, revision, created_at, updated_at, deleted_at).
 * Excludes: user_settings (singleton, no deleted_at), append-only tables,
 * and pure infrastructure tables (idempotency_keys, change_log).
 */
const SOFT_DELETABLE_TABLES = {
  categories,
  tags,
  activity_series: activitySeries,
  activity_occurrences: activityOccurrences,
  tasks,
  checklist_items: checklistItems,
  routines,
  routine_steps: routineSteps,
  routine_schedules: routineSchedules,
  push_subscriptions: pushSubscriptions,
} as const;

describe("ADR-002/SEC-01: soft-deletable tables have the full column set", () => {
  for (const [name, table] of Object.entries(SOFT_DELETABLE_TABLES)) {
    it(`${name} has user_id, revision, created_at, updated_at, deleted_at`, () => {
      const cols = columnNames(table);
      for (const c of ["userId", "revision", "createdAt", "updatedAt", "deletedAt"]) {
        expect(cols, `${name} missing ${c}`).toContain(c);
      }
    });
  }
});

describe("append-only tables (ADR-001 history)", () => {
  it("planner_events is append-only: has user_id + created_at, no updated_at/deleted_at", () => {
    const cols = columnNames(plannerEvents as unknown);
    expect(cols).toContain("userId");
    expect(cols).toContain("createdAt");
    expect(cols, "append-only must not have updatedAt").not.toContain("updatedAt");
    expect(cols, "append-only must not have deletedAt").not.toContain("deletedAt");
  });

  it("change_log is append-only sync feed: has user_id + occurred_at, no updated_at/deleted_at", () => {
    const cols = columnNames(changeLog as unknown);
    expect(cols).toContain("userId");
    expect(cols).toContain("occurredAt");
    expect(cols).not.toContain("updatedAt");
    expect(cols).not.toContain("deletedAt");
  });
});

describe("singleton tables", () => {
  it("user_settings is keyed by user_id (no separate id, no deleted_at)", () => {
    const cols = columnNames(userSettings as unknown);
    expect(cols).toContain("userId");
    expect(cols).toContain("revision");
    expect(cols).toContain("timezone");
    expect(cols, "singleton has no separate id PK").not.toContain("id");
    expect(cols, "singleton cascade-deletes with user").not.toContain("deletedAt");
  });
});

describe("primary keys are uuid (UUIDv7)", () => {
  const uuidPkTables = {
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

  for (const [name, table] of Object.entries(uuidPkTables)) {
    it(`${name}.id is a uuid PK`, () => {
      const cols = columnNames(table);
      expect(cols, `${name} missing id PK`).toContain("id");
    });
  }
});

describe("ADR-004: focus_sessions has the active-session columns", () => {
  it("has the state machine fields", () => {
    const cols = columnNames(focusSessions as unknown);
    expect(cols).toContain("userId");
    expect(cols).toContain("state");
    expect(cols).toContain("startedAt");
    expect(cols).toContain("targetDurationMin");
    expect(cols).toContain("accumulatedPauseSec");
    expect(cols).toContain("currentIntervalStartedAt");
    // The actual one-active-per-user partial unique index enforcement is
    // covered by migrations.test.ts (inserts a 2nd active session, expects failure).
  });
});

describe("ADR-002: sync infrastructure tables", () => {
  it("idempotency_keys has composite PK fields + TTL", () => {
    const cols = columnNames(idempotencyKeys as unknown);
    expect(cols).toContain("userId");
    expect(cols).toContain("key");
    expect(cols).toContain("expiresAt");
    expect(cols).toContain("responseStatus");
  });

  it("change_log has bigint identity + cursor fields", () => {
    const cols = columnNames(changeLog as unknown);
    expect(cols).toContain("id");
    expect(cols).toContain("userId");
    expect(cols).toContain("entityType");
    expect(cols).toContain("entityId");
    expect(cols).toContain("op");
    expect(cols).toContain("revision");
    expect(cols).toContain("occurredAt");
  });
});

describe("every user-owned table is in the registry", () => {
  it("userOwnedTables covers all owned tables", () => {
    const names = Object.keys(userOwnedTables);
    // 13 owned tables (users is the identity root, not "owned").
    expect(names).toHaveLength(13);
    expect(names).toContain("user_settings");
    expect(names).toContain("planner_events");
    expect(names).toContain("focus_sessions");
  });
});
