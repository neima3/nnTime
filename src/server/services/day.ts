/**
 * Server-side day resolution service — shared by Server Components and
 * GET /api/v1/day/{date}. ADR-002: same code path, never self-HTTP.
 *
 * Reads the authenticated user's settings, resolves the day in their planning
 * zone, filters activities into that day, and merges occurrence completion state.
 */
import "server-only";
import { getSession } from "../auth-session";
import {
  getOrCreateSettings,
  listTasks,
  listActivitySeries,
  listUserOccurrences,
  type Db,
} from "../dal";
import { resolveDayBounds, instantToDateStr } from "../temporal/zone";

export interface ResolvedDay {
  userId: string;
  date: string;
  zone: string;
  start: Date;
  end: Date;
  activities: unknown[];
  anytimeTasks: unknown[];
  /** seriesId → occurrence status for the occurrence_key matching series start. */
  occurrenceStatusBySeries: Record<string, string>;
}

/**
 * Resolve today (or a specific date) for the authenticated user. Returns null
 * if not authenticated (the Server Component renders a logged-out state).
 */
export async function getResolvedDay(
  dateStr?: string,
  opts: { db?: Db; tzOverride?: string } = {},
): Promise<ResolvedDay | null> {
  const session = await getSession();
  if (!session) return null;

  const settings = await getOrCreateSettings(session.userId, opts);
  // Allow caller-provided tz override (e.g. ?tz= from the API); otherwise use
  // the user's planning zone from settings.
  const zone = opts.tzOverride || settings.timezone;
  // Prefer the caller's date; otherwise use "today" in the planning zone.
  const target =
    dateStr ?? instantToDateStr(new Date(), zone);

  const bounds = resolveDayBounds(target, zone);

  const series = await listActivitySeries(session.userId, opts);
  const anytimeTasks = await listTasks(session.userId, {
    bucket: "anytime",
    ...opts,
  });
  const occurrences = await listUserOccurrences(session.userId, opts);

  // Keep series whose wall-clock date in the series/planning zone is the target day.
  // One-offs use series.tz for expansion; fall back to planning zone.
  const daySeries = series.filter((s) => {
    const seriesZone = s.tz || zone;
    try {
      return instantToDateStr(s.dtstartLocal, seriesZone) === target;
    } catch {
      return s.dtstartLocal >= bounds.start && s.dtstartLocal < bounds.end;
    }
  });

  const occurrenceStatusBySeries: Record<string, string> = {};
  for (const occ of occurrences) {
    // Prefer status keyed by series for one-offs (occurrence_key ≈ dtstart).
    occurrenceStatusBySeries[occ.seriesId] = occ.status;
  }

  // Anytime tasks: bucket anytime with matching date OR null date (floating).
  const dayAnytime = anytimeTasks.filter((t) => {
    if (!t.date) return true;
    // date column is date-only
    const d =
      t.date instanceof Date
        ? t.date.toISOString().slice(0, 10)
        : String(t.date).slice(0, 10);
    return d === target;
  });

  return {
    userId: session.userId,
    date: target,
    zone,
    start: bounds.start,
    end: bounds.end,
    activities: daySeries,
    anytimeTasks: dayAnytime,
    occurrenceStatusBySeries,
  };
}
