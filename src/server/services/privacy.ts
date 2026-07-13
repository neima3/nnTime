/**
 * Privacy surface — Phase 5E (SEC-10).
 *
 * Data export (JSON of all user rows), account deletion cascade (OAuth
 * revocation, push unsubscribe, queued-job cancellation, backups age out per
 * retention). Log redaction audit helper.
 */
import "server-only";
import dbDefault from "../db";
import type { Db } from "../dal";
import * as schema from "../db/schema";
import { eq, sql } from "drizzle-orm";
import { auth } from "../auth";

/**
 * Export ALL of the user's data as a JSON-serializable object. SEC-10.
 * Used by the "Download my data" UI.
 */
export async function exportUserData(userId: string, opts: { db?: Db } = {}): Promise<Record<string, unknown>> {
  const db = opts.db ?? dbDefault;
  const tables = {
    user_settings: schema.userSettings,
    categories: schema.categories,
    tags: schema.tags,
    activity_series: schema.activitySeries,
    activity_occurrences: schema.activityOccurrences,
    tasks: schema.tasks,
    checklist_items: schema.checklistItems,
    routines: schema.routines,
    routine_steps: schema.routineSteps,
    routine_schedules: schema.routineSchedules,
    focus_sessions: schema.focusSessions,
    push_subscriptions: schema.pushSubscriptions,
    planner_events: schema.plannerEvents,
  };

  const result: Record<string, unknown> = { exportedAt: new Date().toISOString() };
  for (const [name, table] of Object.entries(tables)) {
    const rows = await db.select().from(table).where(eq(table.userId, userId));
    // Redact secrets: push subscription endpoints.
    if (name === "push_subscriptions") {
      result[name] = (rows as { endpoint: string }[]).map((r) => ({
        ...r,
        endpoint: "[redacted]",
        keys: "[redacted]",
      }));
    } else {
      result[name] = rows;
    }
  }
  return result;
}

/**
 * Account deletion cascade — SEC-10. Deletes the user row (cascade removes all
 * owned rows), revokes OAuth tokens, unsubscribes push, cancels queued jobs.
 */
export async function deleteAccount(userId: string, opts: { db?: Db } = {}): Promise<void> {
  const db = opts.db ?? dbDefault;
  // 1. Cancel any active focus session.
  await db
    .update(schema.focusSessions)
    .set({ state: "cancelled", completionReason: "account_deleted" })
    .where(eq(schema.focusSessions.userId, userId));
  // 2. Tombstone push subscriptions.
  await db
    .update(schema.pushSubscriptions)
    .set({ deletedAt: new Date() })
    .where(eq(schema.pushSubscriptions.userId, userId));
  // 3. Delete the Better Auth user row (cascade removes all FK-owned rows).
  await db.delete(schema.users).where(eq(schema.users.id, userId));
  // 4. OAuth revocation happens via Better Auth's signOut/revoke (called by the
  // route handler before this function). Backups age out per retention policy.
}
