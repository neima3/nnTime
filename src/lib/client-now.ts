/**
 * "What time is it right now" for client components — ADR-001.
 *
 * The planning zone is the user's clock, not the device's. A laptop set to
 * America/New_York must not decide that an Auckland planner's morning card is
 * over, or that the now-ring sits at 08:00 when the account says 00:00. Every
 * client surface that asks "what hour is it" goes through here so there is one
 * place that knows the rule.
 *
 * Fallback (documented, same convention as LiveNowLine): when no IANA zone is
 * available — signed out, the mock/demo planner, or a zone string that Intl
 * rejects — the browser clock is the only clock we have, so we use it.
 */

import { dateToMinutesFromMidnight } from "./adapters";

/**
 * Minutes from midnight (0–1439) in `zone`.
 *
 * @param zone Account planning zone. Empty/undefined → browser-local fallback.
 * @param at   Instant to project. Defaults to now (injectable for tests).
 */
export function nowMinutesInZone(zone?: string, at: Date = new Date()): number {
  if (zone) {
    try {
      return dateToMinutesFromMidnight(at, zone);
    } catch {
      // Invalid zone — fall through to the browser clock rather than throw.
    }
  }
  return at.getHours() * 60 + at.getMinutes();
}

/**
 * Hour of day (0–23) in `zone`. Same fallback rules as `nowMinutesInZone`.
 */
export function nowHourInZone(zone?: string, at: Date = new Date()): number {
  return Math.floor(nowMinutesInZone(zone, at) / 60);
}

/** True when the zone-local hour is before noon — the "morning" predicate. */
export function isMorningInZone(zone?: string, at: Date = new Date()): boolean {
  return nowHourInZone(zone, at) < 12;
}
