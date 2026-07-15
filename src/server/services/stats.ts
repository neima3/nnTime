/**
 * Stats + mood service — Phase 5C.
 *
 * Computed from planner_events (append-only history, ADR-001): completion by
 * day/week, focus minutes, energy balance, streaks. Timezone-bucketed in the
 * planning zone. Deleted items retained in aggregates. Empty-state thresholds.
 * Mood check-ins (morning/evening prompt → events table).
 */
import "server-only";
import dbDefault from "../db";
import type { Db } from "../dal";
import * as schema from "../db/schema";
import { and, eq, gte, lte, sql } from "drizzle-orm";
import { getOrCreateSettings } from "../dal";
import { instantToDateStr } from "../temporal/zone";

/**
 * Get stats for a date range. All times bucketed in the user's planning zone.
 */
export async function getStats(
  userId: string,
  range: { from: Date; to: Date },
  opts: { db?: Db } = {},
) {
  const db = opts.db ?? dbDefault;
  const settings = await getOrCreateSettings(userId, opts);
  const zone = settings.timezone;

  // Read all planner_events in the range.
  const events = await db
    .select()
    .from(schema.plannerEvents)
    .where(
      and(
        eq(schema.plannerEvents.userId, userId),
        gte(schema.plannerEvents.occurredAt, range.from),
        lte(schema.plannerEvents.occurredAt, range.to),
      ),
    );

  // Bucket by planning-zone date.
  const byDate: Record<string, { completed: number; focusMin: number; mood: string | null }> = {};
  for (const ev of events) {
    const dateStr = instantToDateStr(ev.occurredAt, zone);
    if (!byDate[dateStr]) byDate[dateStr] = { completed: 0, focusMin: 0, mood: null };
    if (ev.eventType === "complete") byDate[dateStr].completed++;
    if (ev.eventType === "focus_stop") {
      const payload = ev.payload as { durationMin?: number };
      if (payload?.durationMin) byDate[dateStr].focusMin += payload.durationMin;
    }
    if (ev.eventType === "mood_checkin") {
      const payload = ev.payload as { mood?: string };
      byDate[dateStr].mood = payload?.mood ?? null;
    }
  }

  // Compute streak: consecutive days (in planning zone) with ≥1 completion,
  // 1-day grace, ending today or yesterday.
  const streak = computeStreak(byDate);

  // Energy balance.
  const energyCounts = { low: 0, medium: 0, high: 0 };
  for (const ev of events) {
    if (ev.eventType === "energy_change") {
      const payload = ev.payload as { energy?: "low" | "medium" | "high" };
      if (payload?.energy) energyCounts[payload.energy]++;
    }
  }

  return {
    byDate,
    streak,
    energyBalance: energyCounts,
    totalCompleted: events.filter((e) => e.eventType === "complete").length,
    totalFocusMin: events
      .filter((e) => e.eventType === "focus_stop")
      .reduce((sum, e) => sum + ((e.payload as { durationMin?: number })?.durationMin ?? 0), 0),
  };
}

/**
 * Record a mood check-in (1-tap scale + optional note → planner_events).
 */
export async function recordMoodCheckin(
  userId: string,
  mood: string,
  note?: string,
  opts: { db?: Db } = {},
) {
  const db = opts.db ?? dbDefault;
  const settings = await getOrCreateSettings(userId, opts);
  await db.insert(schema.plannerEvents).values({
    id: crypto.randomUUID(),
    userId,
    entityType: "user",
    // entityId is uuid column; store synthetic id, user in payload (Better Auth text PKs).
    entityId: crypto.randomUUID(),
    eventType: "mood_checkin",
    payload: { mood, note, userId },
    occurredAt: new Date(),
    tz: settings.timezone,
  });
}

/**
 * Compute a soft streak: consecutive days with ≥1 completion, 1-day grace.
 */
function computeStreak(
  byDate: Record<string, { completed: number }>,
): { current: number; best: number } {
  const dates = Object.keys(byDate)
    .filter((d) => byDate[d].completed > 0)
    .sort();
  if (dates.length === 0) return { current: 0, best: 0 };

  let best = 1;
  let currentRun = 1;
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  for (let i = 1; i < dates.length; i++) {
    const prev = new Date(dates[i - 1]);
    const curr = new Date(dates[i]);
    const diffDays = Math.round((curr.getTime() - prev.getTime()) / 86400000);
    if (diffDays === 1) {
      currentRun++;
    } else if (diffDays === 2) {
      // 1-day grace.
      currentRun++;
    } else {
      best = Math.max(best, currentRun);
      currentRun = 1;
    }
  }
  best = Math.max(best, currentRun);

  // Current streak: if the last active date is today or yesterday.
  const lastDate = dates[dates.length - 1];
  const current = lastDate === today || lastDate === yesterday ? currentRun : 0;

  return { current, best };
}
