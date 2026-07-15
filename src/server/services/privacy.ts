/**
 * Privacy surface — Phase 5E (SEC-10).
 *
 * Data export (JSON of all user rows), account deletion cascade.
 * Handles prod schema drift gracefully (per-table try/catch).
 */
import "server-only";
import dbDefault from "../db";
import type { Db } from "../dal";
import * as schema from "../db/schema";
import { eq } from "drizzle-orm";

/**
 * Export ALL of the user's data as a JSON-serializable object. SEC-10.
 * Each table query is individually try/caught so one schema-mismatched table
 * doesn't fail the entire export.
 */
export async function exportUserData(
  userId: string,
  opts: { db?: Db } = {},
): Promise<Record<string, unknown>> {
  const db = opts.db ?? dbDefault;
  const result: Record<string, unknown> = { exportedAt: new Date().toISOString() };

  const queries: Array<[string, Promise<unknown>]> = [
    ["user_settings", db.select().from(schema.userSettings).where(eq(schema.userSettings.userId, userId))],
    ["categories", db.select().from(schema.categories).where(eq(schema.categories.userId, userId))],
    ["tags", db.select().from(schema.tags).where(eq(schema.tags.userId, userId))],
    ["activity_series", db.select().from(schema.activitySeries).where(eq(schema.activitySeries.userId, userId))],
    ["activity_occurrences", db.select().from(schema.activityOccurrences).where(eq(schema.activityOccurrences.userId, userId))],
    ["tasks", db.select().from(schema.tasks).where(eq(schema.tasks.userId, userId))],
    ["checklist_items", db.select().from(schema.checklistItems).where(eq(schema.checklistItems.userId, userId))],
    ["routines", db.select().from(schema.routines).where(eq(schema.routines.userId, userId))],
    ["routine_steps", db.select().from(schema.routineSteps).where(eq(schema.routineSteps.userId, userId))],
    ["routine_schedules", db.select().from(schema.routineSchedules).where(eq(schema.routineSchedules.userId, userId))],
    ["focus_sessions", db.select().from(schema.focusSessions).where(eq(schema.focusSessions.userId, userId))],
    ["push_subscriptions", db.select().from(schema.pushSubscriptions).where(eq(schema.pushSubscriptions.userId, userId))],
    ["planner_events", db.select().from(schema.plannerEvents).where(eq(schema.plannerEvents.userId, userId))],
  ];

  for (const [name, query] of queries) {
    try {
      const rows = await query;
      if (name === "push_subscriptions") {
        result[name] = (rows as { endpoint: string }[]).map((r) => ({
          ...r,
          endpoint: "[redacted]",
          keys: "[redacted]",
        }));
      } else {
        result[name] = rows;
      }
    } catch {
      // Schema drift on this table — include empty array instead of failing.
      result[name] = [];
    }
  }

  return result;
}

/**
 * Account deletion cascade — SEC-10.
 */
export async function deleteAccount(
  userId: string,
  opts: { db?: Db } = {},
): Promise<void> {
  const db = opts.db ?? dbDefault;
  // Cancel any active focus session.
  await db
    .update(schema.focusSessions)
    .set({ state: "cancelled", completionReason: "account_deleted" })
    .where(eq(schema.focusSessions.userId, userId));
  // Tombstone push subscriptions.
  await db
    .update(schema.pushSubscriptions)
    .set({ deletedAt: new Date() })
    .where(eq(schema.pushSubscriptions.userId, userId));
  // Delete the Better Auth user row (cascade removes all FK-owned rows).
  await db.delete(schema.users).where(eq(schema.users.id, userId));
}
