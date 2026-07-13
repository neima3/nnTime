/**
 * Server-side day resolution service — shared by Server Components and the
 * (future) /api/v1/day route. ADR-002: same code path, never self-HTTP.
 *
 * Reads the authenticated user's settings, resolves the day in their planning
 * zone, and returns activities + anytime tasks for that day.
 */
import "server-only";
import { getSession } from "../auth-session";
import { getOrCreateSettings, listTasks, listActivitySeries, type Db } from "../dal";
import { resolveDayBounds } from "../temporal/zone";

export interface ResolvedDay {
  userId: string;
  date: string;
  zone: string;
  start: Date;
  end: Date;
  activities: unknown[];
  anytimeTasks: unknown[];
}

/**
 * Resolve today (or a specific date) for the authenticated user. Returns null
 * if not authenticated (the Server Component renders a logged-out state).
 */
export async function getResolvedDay(
  dateStr?: string,
  opts: { db?: Db } = {},
): Promise<ResolvedDay | null> {
  const session = await getSession();
  if (!session) return null;

  const settings = await getOrCreateSettings(session.userId, opts);
  const zone = settings.timezone;
  const target = dateStr ?? new Date().toISOString().slice(0, 10);

  const bounds = resolveDayBounds(target, zone);

  // For 1D: return the raw series + tasks. Phase 2A's recurrence engine expands
  // series into occurrences within [start, end). For now, list all non-deleted
  // series and anytime tasks; the UI renders what it gets.
  const series = await listActivitySeries(session.userId, opts);
  const anytimeTasks = await listTasks(session.userId, {
    bucket: "anytime",
    ...opts,
  });

  return {
    userId: session.userId,
    date: target,
    zone,
    start: bounds.start,
    end: bounds.end,
    activities: series,
    anytimeTasks,
  };
}
