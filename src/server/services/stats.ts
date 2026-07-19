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
import { and, eq, gte, lte } from "drizzle-orm";
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
    estimate: computeEstimateCalibration(events),
  };
}

/* -------------------------------------------------------------------------- */
/* Time-estimation calibration (Phase 6)                                      */
/* -------------------------------------------------------------------------- */

export interface EstimateCalibration {
  sessions: number;
  avgTargetMin: number;
  avgActualMin: number;
  ratio: number;
}

const CALIBRATION_WINDOW_DAYS = 14;
const CALIBRATION_MIN_SESSIONS = 5;
const CALIBRATION_ABANDONED_MIN = 3;

/**
 * Pure aggregation over planner_events: average target vs. actual focus-session
 * minutes for the last 14 days, so we can show a kind, data-driven "you tend to
 * under-plan by Nx" signal. Needs both `targetDurationMin` and `elapsedMin` on
 * the focus_stop payload (see the focus-sessions PATCH route). Sessions under
 * 3 actual minutes are treated as abandoned and excluded. Returns null when
 * fewer than 5 qualifying sessions exist — not enough signal to be useful.
 */
export function computeEstimateCalibration(
  events: Array<{ eventType: string; occurredAt: Date; payload: unknown }>,
  opts: { now?: Date } = {},
): EstimateCalibration | null {
  const now = opts.now ?? new Date();
  const windowStart = new Date(now.getTime() - CALIBRATION_WINDOW_DAYS * 86400000);

  const qualifying = events.filter((ev) => {
    if (ev.eventType !== "focus_stop") return false;
    if (ev.occurredAt < windowStart || ev.occurredAt > now) return false;
    const payload = ev.payload as { targetDurationMin?: number; elapsedMin?: number };
    if (typeof payload?.targetDurationMin !== "number") return false;
    if (typeof payload?.elapsedMin !== "number") return false;
    if (payload.elapsedMin < CALIBRATION_ABANDONED_MIN) return false;
    return true;
  });

  if (qualifying.length < CALIBRATION_MIN_SESSIONS) return null;

  const totals = qualifying.reduce(
    (acc, ev) => {
      const payload = ev.payload as { targetDurationMin: number; elapsedMin: number };
      acc.target += payload.targetDurationMin;
      acc.actual += payload.elapsedMin;
      return acc;
    },
    { target: 0, actual: 0 },
  );

  const avgTargetMin = Math.round(totals.target / qualifying.length);
  const avgActualMin = Math.round(totals.actual / qualifying.length);
  if (avgTargetMin <= 0) return null;
  const ratio = Math.round((avgActualMin / avgTargetMin) * 10) / 10;

  return { sessions: qualifying.length, avgTargetMin, avgActualMin, ratio };
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
