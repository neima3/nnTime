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
import { and, eq, gte, inArray, lte } from "drizzle-orm";
import { getOrCreateSettings } from "../dal";
import { instantToDateStr, instantToWallFields } from "../temporal/zone";

/** Minimal shape the pure stats helpers need — matches DbPlannerEvent. */
export interface PlannerEventLike {
  eventType: string;
  occurredAt: Date;
  payload: unknown;
  /** Series id — needed to pair a `complete` with the `uncomplete` that undoes it. */
  entityId?: string | null;
}

/**
 * Reduce the raw event log to the completions that still stand.
 *
 * `planner_events` is append-only, so un-completing an activity appends an
 * `uncomplete` row rather than removing the `complete`. Counting raw `complete`
 * events therefore inflated every number: complete → undo → complete read as 2,
 * and each further mis-tap-and-correct added another. Insights, Totals, the
 * soft streak and the reward garden all sit on this count.
 *
 * Walking chronologically, a `complete` marks its occurrence done and an
 * `uncomplete` clears it, so an occurrence contributes at most once — on the
 * date of its most recent `complete`.
 */
export function netCompletions<T extends PlannerEventLike>(events: T[]): T[] {
  const occurrenceKeyOf = (ev: T) =>
    (ev.payload as { occurrenceKey?: string } | null)?.occurrenceKey ?? "";
  const keyOf = (ev: T) =>
    `${ev.entityId ?? ""}|${occurrenceKeyOf(ev)}`;

  const live = new Map<string, T>();
  const ordered = [...events].sort(
    (a, b) => a.occurredAt.getTime() - b.occurredAt.getTime(),
  );

  for (const ev of ordered) {
    if (ev.eventType === "complete") {
      live.set(keyOf(ev), ev);
    } else if (ev.eventType === "uncomplete") {
      const occurrenceKey = occurrenceKeyOf(ev);
      if (occurrenceKey) {
        live.delete(keyOf(ev));
      } else {
        // Legacy rows carried an empty payload; clear every occurrence of the
        // series so old data still nets out instead of staying stuck counted.
        const prefix = `${ev.entityId ?? ""}|`;
        for (const key of [...live.keys()]) {
          if (key.startsWith(prefix)) live.delete(key);
        }
      }
    }
  }
  return [...live.values()];
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

  // Completions that still stand (see netCompletions) — undone ones must not
  // keep counting toward Insights, Totals, the streak or the garden.
  const liveCompletions = netCompletions(events);

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

  // Energy pattern (Round 9 / E07): join high-energy completions to their
  // series and learn WHEN heavy work actually gets done. Like focusHours,
  // this looks at its own fixed window (60 d) independent of `range`.
  const patternStart = new Date(now.getTime() - ENERGY_PATTERN_WINDOW_DAYS * 86400000);
  const preloaded =
    range.from <= patternStart && range.to >= now
      ? liveCompletions
      : null;
  const patternInput = await loadEnergyCompletions(db, userId, zone, now, preloaded);

  return {
    byDate,
    streak,
    energyBalance: energyCounts,
    totalCompleted: liveCompletions.length,
    totalFocusMin: events
      .filter((e) => e.eventType === "focus_stop")
      .reduce((sum, e) => sum + ((e.payload as { durationMin?: number })?.durationMin ?? 0), 0),
    estimate: computeEstimateCalibration(events),
    focusHours: computeFocusHours(focusEvents, zone, { now }),
    energyPattern: computeEnergyPattern(patternInput),
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
    if (ev.eventType === "focus_stop") {
      const payload = ev.payload as { durationMin?: number };
      if (payload?.durationMin) byDate[dateStr].focusMin += payload.durationMin;
    }
    if (ev.eventType === "mood_checkin") {
      const payload = ev.payload as { mood?: string };
      byDate[dateStr].mood = payload?.mood ?? null;
    }
  }
  // Completions are tallied from the netted set, so an undone one stops
  // counting and re-completing does not add a second.
  for (const ev of netCompletions(events)) {
    const dateStr = instantToDateStr(ev.occurredAt, zone);
    if (!byDate[dateStr]) byDate[dateStr] = { completed: 0, focusMin: 0, mood: null };
    byDate[dateStr].completed++;
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

/* -------------------------------------------------------------------------- */
/* Energy-pattern learning (Round 9 / parity E07)                             */
/* -------------------------------------------------------------------------- */

export interface EnergyPattern {
  /** High-energy completions per scheduled hour-of-day (planning zone). */
  byHour: number[];
  /** How many high-energy completions the window is built on. */
  sampled: number;
  /** Best 3-hour window (start inclusive, end exclusive, wraps at 24), or
   *  null when the evidence is too thin to claim one. */
  window: { start: number; end: number } | null;
}

/** Learn from a fixed trailing window, independent of the requested range. */
export const ENERGY_PATTERN_WINDOW_DAYS = 60;

interface CompletionEventRow {
  entityId: string | null;
  occurredAt: Date;
  payload: unknown;
}

/** Load and join the pattern's inputs: high-energy completions with their
 *  scheduled hour projected into the planning zone. `preloaded` lets getStats
 *  reuse events it already fetched when its range covers the window. */
async function loadEnergyCompletions(
  db: Db,
  userId: string,
  zone: string,
  now: Date,
  preloaded: CompletionEventRow[] | null,
): Promise<Array<{ hourOfDay: number; energy: "low" | "medium" | "high" | null }>> {
  const patternStart = new Date(now.getTime() - ENERGY_PATTERN_WINDOW_DAYS * 86400000);
  const completeEvents =
    preloaded ??
    (await db
      .select()
      .from(schema.plannerEvents)
      .where(
        and(
          eq(schema.plannerEvents.userId, userId),
          eq(schema.plannerEvents.eventType, "complete"),
          gte(schema.plannerEvents.occurredAt, patternStart),
          lte(schema.plannerEvents.occurredAt, now),
        ),
      ));

  const seriesIds = [...new Set(completeEvents.map((e) => e.entityId).filter(Boolean))];
  const energyBySeries = new Map<string, "low" | "medium" | "high" | null>();
  if (seriesIds.length > 0) {
    const rows = await db
      .select({ id: schema.activitySeries.id, energy: schema.activitySeries.energy })
      .from(schema.activitySeries)
      .where(
        and(
          eq(schema.activitySeries.userId, userId),
          inArray(schema.activitySeries.id, seriesIds as string[]),
        ),
      );
    for (const r of rows) energyBySeries.set(r.id, r.energy);
  }

  return completeEvents.map((ev) => {
    // Prefer the occurrence's SCHEDULED hour; an event without a key (older
    // rows) falls back to when it was completed — still a real signal for
    // "when does heavy work happen".
    const key = (ev.payload as { occurrenceKey?: string })?.occurrenceKey;
    const when = key ? new Date(key) : ev.occurredAt;
    const instant = Number.isNaN(when.getTime()) ? ev.occurredAt : when;
    return {
      hourOfDay: instantToWallFields(instant, zone).hour,
      energy: energyBySeries.get(ev.entityId ?? "") ?? null,
    };
  });
}

/** The learned pattern alone — the plan-day route asks for just this. */
export async function getEnergyPattern(
  userId: string,
  opts: { db?: Db; now?: Date } = {},
): Promise<EnergyPattern> {
  const db = opts.db ?? dbDefault;
  const now = opts.now ?? new Date();
  const settings = await getOrCreateSettings(userId, opts);
  const input = await loadEnergyCompletions(db, userId, settings.timezone, now, null);
  return computeEnergyPattern(input);
}
/** Below this many high-energy completions we say nothing at all. */
export const ENERGY_PATTERN_MIN_SAMPLES = 8;
/** The best window must itself hold at least this many to be a pattern. */
export const ENERGY_PATTERN_MIN_IN_WINDOW = 3;
const ENERGY_PATTERN_WINDOW_HOURS = 3;

/**
 * Pure: learn when this user's HIGH-energy work actually gets completed.
 * Input is pre-joined `{hourOfDay, energy}` completions (the service joins
 * completion events to their series' energy and projects the occurrence's
 * scheduled hour into the planning zone). Honest by construction: below the
 * evidence gates `window` is null and callers show nothing.
 */
export function computeEnergyPattern(
  completions: Array<{ hourOfDay: number; energy: "low" | "medium" | "high" | null }>,
): EnergyPattern {
  const byHour = new Array(24).fill(0) as number[];
  let sampled = 0;
  for (const c of completions) {
    if (c.energy !== "high") continue;
    const h = Math.trunc(c.hourOfDay);
    if (h < 0 || h > 23) continue;
    byHour[h]++;
    sampled++;
  }

  if (sampled < ENERGY_PATTERN_MIN_SAMPLES) {
    return { byHour, sampled, window: null };
  }

  // Best 3-hour window, wrap-aware (22–01 is a real evening pattern). Ties
  // prefer a window that STARTS on an hour with signal — "9–12" reads truer
  // than "8–11" when everything landed at 9 and 10.
  let best = { start: 0, count: -1 };
  for (let start = 0; start < 24; start++) {
    let count = 0;
    for (let i = 0; i < ENERGY_PATTERN_WINDOW_HOURS; i++) {
      count += byHour[(start + i) % 24];
    }
    const beats =
      count > best.count ||
      (count === best.count && byHour[start] > 0 && byHour[best.start] === 0);
    if (beats) best = { start, count };
  }

  if (best.count < ENERGY_PATTERN_MIN_IN_WINDOW) {
    return { byHour, sampled, window: null };
  }

  return {
    byHour,
    sampled,
    window: { start: best.start, end: (best.start + ENERGY_PATTERN_WINDOW_HOURS) % 24 },
  };
}
