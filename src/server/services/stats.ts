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
import { instantToDateStr, instantToWallFields } from "../temporal/zone";

/** Minimal shape the pure stats helpers need — matches DbPlannerEvent. */
export interface PlannerEventLike {
  eventType: string;
  occurredAt: Date;
  payload: unknown;
}

/**
 * Get stats for a date range. All times bucketed in the user's planning zone.
 */
export async function getStats(
  userId: string,
  range: { from: Date; to: Date },
  opts: { db?: Db; now?: Date } = {},
) {
  const db = opts.db ?? dbDefault;
  const settings = await getOrCreateSettings(userId, opts);
  const zone = settings.timezone;
  const now = opts.now ?? new Date();

  // Read all planner_events in the requested range.
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

  // "Your focus hours" always looks at a fixed 30-day window, independent of
  // the requested `range` (which may be as short as 1 day) — pull it
  // separately when the requested range doesn't already cover it.
  const focusWindowStart = new Date(now.getTime() - FOCUS_HOURS_WINDOW_DAYS * 86400000);
  const focusEvents =
    range.from <= focusWindowStart && range.to >= now
      ? events.filter((e) => e.eventType === "focus_stop")
      : await db
          .select()
          .from(schema.plannerEvents)
          .where(
            and(
              eq(schema.plannerEvents.userId, userId),
              eq(schema.plannerEvents.eventType, "focus_stop"),
              gte(schema.plannerEvents.occurredAt, focusWindowStart),
              lte(schema.plannerEvents.occurredAt, now),
            ),
          );

  // Bucket by planning-zone date.
  const byDate = bucketEventsByZoneDate(events, zone);

  // Compute streak: consecutive days (in planning zone) with ≥1 completion,
  // 1-day grace, ending today or yesterday (also planning-zone "today").
  const streak = computeStreak(byDate, zone, now);

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
    focusHours: computeFocusHours(focusEvents, zone, { now }),
  };
}

/**
 * Pure: bucket planner_events into planning-zone calendar dates. Split out
 * of `getStats` so it (and the streak calc built on top of it) can be unit
 * tested without a DB. Uses `instantToDateStr`, which projects the UTC
 * `occurredAt` instant into the given IANA zone's wall-clock date — so an
 * event stored at 01:30Z lands on the *previous* local day for a zone west
 * of UTC (e.g. America/New_York), matching what the user actually saw.
 */
export function bucketEventsByZoneDate(
  events: PlannerEventLike[],
  zone: string,
): Record<string, { completed: number; focusMin: number; mood: string | null }> {
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
  return byDate;
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
 * Compute a soft streak: consecutive days (in the planning zone) with ≥1
 * completion, 1-day grace. `today`/`yesterday` are resolved in `zone`
 * (not the server's UTC clock) so a late-evening completion near a UTC
 * date rollover still counts toward the right day's streak.
 */
export function computeStreak(
  byDate: Record<string, { completed: number }>,
  zone: string,
  now: Date = new Date(),
): { current: number; best: number } {
  const dates = Object.keys(byDate)
    .filter((d) => byDate[d].completed > 0)
    .sort();
  if (dates.length === 0) return { current: 0, best: 0 };

  let best = 1;
  let currentRun = 1;
  const today = instantToDateStr(now, zone);
  const yesterday = instantToDateStr(new Date(now.getTime() - 86400000), zone);

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

/* -------------------------------------------------------------------------- */
/* "Your focus hours" strip (Wave 2 Phase 6)                                  */
/* -------------------------------------------------------------------------- */

export interface FocusHours {
  /** Session counts by zone-local start hour, index 0–23. */
  hours: number[];
  /** Hour (0–23) with the most sessions. */
  peakHour: number;
}

const FOCUS_HOURS_WINDOW_DAYS = 30;
const FOCUS_HOURS_MIN_EVENTS = 5;

/**
 * Pure aggregation over planner_events: a 24-bucket histogram of focus_stop
 * sessions by the zone-local hour the session *started*. Start is derived by
 * subtracting the session's elapsed minutes from `occurredAt` (the stop
 * time) when available; falls back to the stop instant's own hour otherwise.
 * Only the last 30 days count. Returns null under 5 qualifying sessions —
 * not enough signal for a peak-hour claim to be honest.
 */
export function computeFocusHours(
  events: PlannerEventLike[],
  zone: string,
  opts: { now?: Date } = {},
): FocusHours | null {
  const now = opts.now ?? new Date();
  const windowStart = new Date(now.getTime() - FOCUS_HOURS_WINDOW_DAYS * 86400000);

  const qualifying = events.filter((ev) => {
    if (ev.eventType !== "focus_stop") return false;
    if (ev.occurredAt < windowStart || ev.occurredAt > now) return false;
    return true;
  });

  if (qualifying.length < FOCUS_HOURS_MIN_EVENTS) return null;

  const hours = new Array(24).fill(0) as number[];
  for (const ev of qualifying) {
    const payload = ev.payload as { elapsedMin?: number };
    const start =
      typeof payload?.elapsedMin === "number" && payload.elapsedMin > 0
        ? new Date(ev.occurredAt.getTime() - payload.elapsedMin * 60_000)
        : ev.occurredAt;
    const { hour } = instantToWallFields(start, zone);
    hours[hour]++;
  }

  let peakHour = 0;
  for (let h = 1; h < 24; h++) {
    if (hours[h] > hours[peakHour]) peakHour = h;
  }

  return { hours, peakHour };
}
