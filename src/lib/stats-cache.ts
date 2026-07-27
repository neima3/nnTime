/**
 * Client-side memo for GET /api/v1/stats (T16 — dedupe the Today waterfall).
 *
 * DailyBrief, PeakFocusNudge, SoftStreaks, and the timeline's calibration hint
 * all read stats on mount; without this a single Today view fires four
 * requests, each re-aggregating planner_events server-side. Same contract as
 * settings-cache: a module-level promise cache (60 s TTL) keyed by the `days`
 * window, failures never cached beyond the failed attempt.
 *
 * The estimate block is computed from a fixed 14-day window server-side, so
 * any `days` ≥ 14 returns the identical estimate — callers that only need the
 * calibration ratio should share the 30-day entry rather than mint a new key.
 */

export interface StatsPayload {
  estimate?: { ratio: number; sessions: number } | null;
  focusHours?: { hours: number[]; peakHour: number } | null;
  streak?: { current?: number; best?: number } | null;
  [key: string]: unknown;
}

const TTL_MS = 60_000;

const cached = new Map<string, { promise: Promise<StatsPayload | null>; at: number }>();

/** Fetch stats for a window, deduped/memoized for 60 s across all callers. */
export function getStatsCached(days?: number): Promise<StatsPayload | null> {
  const key = days == null ? "default" : String(days);
  const now = Date.now();
  const hit = cached.get(key);
  if (hit && now - hit.at < TTL_MS) return hit.promise;

  const url = days == null ? "/api/v1/stats" : `/api/v1/stats?days=${days}`;
  const attempt = fetch(url)
    .then((r) => (r.ok ? (r.json() as Promise<StatsPayload>) : null))
    .catch(() => null)
    .then((result) => {
      if (result == null) {
        // A failed/unauthenticated attempt must not poison the cache — clear
        // the entry so the next call retries instead of waiting out the TTL.
        cached.delete(key);
      }
      return result;
    });

  cached.set(key, { promise: attempt, at: now });
  return attempt;
}

/** Force refetches (e.g. after completing activities changes the aggregates). */
export function invalidateStatsCache() {
  cached.clear();
}
