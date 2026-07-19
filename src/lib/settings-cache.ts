/**
 * Client-side memo for GET /api/v1/settings (Phase 8 — dedupe fetch waterfalls).
 *
 * NowBar, TimezoneNudge, and SettingsClient all read settings on mount; without
 * this each one fires its own request on every page view. A single module-level
 * promise cache (60 s TTL) serves all callers. Failures (401 / offline) resolve
 * null and are never cached beyond the failed attempt — the cache is cleared so
 * the next call retries fresh.
 */

export interface SettingsLike {
  timezone: string;
  theme: "system" | "light" | "dark";
  reducedStimulation: boolean;
  hourCycle: "h12" | "h24";
  weekStart: number;
  notificationPrefs: Record<string, unknown>;
  revision: number;
}

const TTL_MS = 60_000;

let cached: Promise<SettingsLike | null> | null = null;
let cachedAt = 0;

/** Fetch settings, deduped/memoized for 60 s across all callers. */
export function getSettingsCached(): Promise<SettingsLike | null> {
  const now = Date.now();
  if (cached && now - cachedAt < TTL_MS) return cached;

  const attempt = fetch("/api/v1/settings")
    .then((r) => (r.ok ? (r.json() as Promise<SettingsLike>) : null))
    .catch(() => null)
    .then((result) => {
      if (result == null) {
        // Don't let a failed/unauthenticated attempt poison the cache — clear
        // it so the next call retries instead of waiting out the TTL.
        cached = null;
        cachedAt = 0;
      }
      return result;
    });

  cached = attempt;
  cachedAt = now;
  return attempt;
}

/** Force the next getSettingsCached() call to refetch (e.g. after a PATCH). */
export function invalidateSettingsCache() {
  cached = null;
  cachedAt = 0;
}
