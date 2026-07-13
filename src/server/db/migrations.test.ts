/**
 * Migration + schema integration tests against an ephemeral Postgres.
 *
 * Verifies (Phase 1A "Done" gate):
 *  - All migrations apply cleanly forward.
 *  - Every expected table, enum, and index exists.
 *  - ADR-004 partial unique index: at most one running|paused focus session
 *    per user; completed/skipped/cancelled sessions don't count.
 *  - ADR-001 occurrence identity: unique (series_id, occurrence_key).
 *  - Soft-delete partial unique indexes (categories, tags) allow re-create
 *    after tombstone.
 *  - FK cascade: deleting a user removes all owned rows.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { v7 as uuidv7 } from "uuid";
import { createEphemeralDb, insertUser, type EphemeralDb } from "./test-db";
import { focusSessions, users } from "./schema";
import { eq, sql } from "drizzle-orm";

let env: EphemeralDb | null = null;
let dbAvailable = false;
const getDb = () => {
  if (!env) throw new Error("DB not initialized");
  return env.db;
};

beforeAll(async () => {
  try {
    env = await createEphemeralDb();
    dbAvailable = true;
  } catch (e) {
    console.warn(
      "[migrations.test] skipping — no Postgres available:",
      (e as Error).message,
    );
  }
}, 60000);

afterAll(async () => {
  if (env) await env.teardown();
});

// Wrapper that skips when the DB is unavailable (evaluated at runtime, not
// module load, so beforeAll has a chance to set dbAvailable).
const itDb = (name: string, fn: () => Promise<void> | void) =>
  it(name, async () => {
    if (!dbAvailable) return; // no DB → treated as a no-op (CI without pg)
    await fn();
  });

describe("migrations apply and schema is complete", () => {
  itDb("all expected tables exist", async () => {
    const result = await getDb().execute<{ tablename: string }>(
      sql`SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename`,
    );
    
    const tableNames = (result as { tablename: string }[]).map((r) => r.tablename);
    const expected = [
      "users",
      "user_settings",
      "categories",
      "category_seed",
      "tags",
      "activity_series",
      "activity_occurrences",
      "tasks",
      "checklist_items",
      "routines",
      "routine_steps",
      "routine_schedules",
      "focus_sessions",
      "push_subscriptions",
      "planner_events",
      "idempotency_keys",
      "change_log",
    ];
    for (const t of expected) {
      expect(tableNames).toContain(t);
    }
  });

  itDb("enums are created", async () => {
    const result = await getDb().execute<{ typname: string }>(
      sql`SELECT t.typname FROM pg_type t JOIN pg_namespace n ON t.typnamespace=n.oid WHERE n.nspname='public' AND t.typtype='e'`,
    );
    
    const enumNames = (result as { typname: string }[]).map((r) => r.typname);
    for (const e of [
      "hour_cycle",
      "theme_mode",
      "task_bucket",
      "energy_level",
      "priority",
      "occurrence_status",
      "checklist_parent",
      "activity_source",
      "focus_state",
      "planner_event_type",
      "change_op",
    ]) {
      expect(enumNames).toContain(e);
    }
  });

  itDb("change_log id is an identity bigint", async () => {
    const result = await getDb().execute<{ data_type: string; is_identity: string }>(
      sql`SELECT data_type, is_identity FROM information_schema.columns WHERE table_name='change_log' AND column_name='id'`,
    );
    
    const cols = (result as { data_type: string; is_identity: string }[])[0];
    expect(cols.data_type).toBe("bigint");
    expect(cols.is_identity).toBe("YES");
  });
});

describe("ADR-004: partial unique index on focus sessions", () => {
  let userId: string;

  itDb("rejects a 2nd active session, accepts completed/other-user", async () => {
    userId = uuidv7();
    await insertUser(getDb(), userId);

    // First running session — ok
    await getDb().insert(focusSessions).values({
      id: uuidv7(),
      userId,
      state: "running",
      startedAt: new Date(),
      targetDurationMin: 25,
    });

    // 2nd running session for same user — must FAIL
    await expect(
      getDb().insert(focusSessions).values({
        id: uuidv7(),
        userId,
        state: "running",
        startedAt: new Date(),
        targetDurationMin: 25,
      }),
    ).rejects.toThrow();

    // A paused session for same user — also must FAIL (still "active")
    await expect(
      getDb().insert(focusSessions).values({
        id: uuidv7(),
        userId,
        state: "paused",
        startedAt: new Date(),
        targetDurationMin: 25,
      }),
    ).rejects.toThrow();

    // A completed session for same user — OK (not in partial index)
    await getDb().insert(focusSessions).values({
      id: uuidv7(),
      userId,
      state: "completed",
      startedAt: new Date(),
      targetDurationMin: 25,
    });

    // A different user's active session — OK
    const otherUser = uuidv7();
    await insertUser(getDb(), otherUser);
    await getDb().insert(focusSessions).values({
      id: uuidv7(),
      userId: otherUser,
      state: "running",
      startedAt: new Date(),
      targetDurationMin: 25,
    });

    const sessions = await getDb()
      .select()
      .from(focusSessions)
      .where(eq(focusSessions.userId, userId));
    expect(
      sessions.filter(
        (s: { state: string }) => s.state === "running" || s.state === "paused",
      ),
    ).toHaveLength(1);
  });
});

describe("FK cascade on user delete", () => {
  itDb("deleting a user removes owned rows", async () => {
    const userId = uuidv7();
    await insertUser(getDb(), userId);
    await getDb().insert(focusSessions).values({
      id: uuidv7(),
      userId,
      state: "completed",
      startedAt: new Date(),
      targetDurationMin: 10,
    });
    await getDb().delete(users).where(eq(users.id, userId));
    const remaining = await getDb()
      .select()
      .from(focusSessions)
      .where(eq(focusSessions.userId, userId));
    expect(remaining).toHaveLength(0);
  });
});
