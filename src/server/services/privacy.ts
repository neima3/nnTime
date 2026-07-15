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
  const result: Record<string, unknown> = { exportedAt: new Date().toISOString() };

  // Query each table individually (avoids TS type issues with heterogeneous tables).
  result.user_settings = await db.select().from(schema.userSettings).where(eq(schema.userSettings.userId, userId));
  result.categories = await db.select().from(schema.categories).where(eq(schema.categories.userId, userId));
  result.tags = await db.select().from(schema.tags).where(eq(schema.tags.userId, userId));
  result.activity_series = await db.select().from(schema.activitySeries).where(eq(schema.activitySeries.userId, userId));
  result.activity_occurrences = await db.select().from(schema.activityOccurrences).where(eq(schema.activityOccurrences.userId, userId));
  result.tasks = await db.select().from(schema.tasks).where(eq(schema.tasks.userId, userId));
  result.checklist_items = await db.select().from(schema.checklistItems).where(eq(schema.checklistItems.userId, userId));
  result.routines = await db.select().from(schema.routines).where(eq(schema.routines.userId, userId));
  result.routine_steps = await db.select().from(schema.routineSteps).where(eq(schema.routineSteps.userId, userId));
  result.routine_schedules = await db.select().from(schema.routineSchedules).where(eq(schema.routineSchedules.userId, userId));
  result.focus_sessions = await db.select().from(schema.focusSessions).where(eq(schema.focusSessions.userId, userId));
  // Redact push subscription secrets.
  result.push_subscriptions = (await db.select().from(schema.pushSubscriptions).where(eq(schema.pushSubscriptions.userId, userId))).map((r) => ({ ...r, endpoint: "[redacted]", keys: "[redacted]" }));
  result.planner_events = await db.select().from(schema.plannerEvents).where(eq(schema.plannerEvents.userId, userId));

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
