/**
 * Client-side calendar date helpers.
 *
 * Prefer these over `new Date().toISOString().slice(0, 10)` which returns the
 * UTC calendar day and is wrong near midnight for most planning zones.
 */

/** Format parts as YYYY-MM-DD. */
function ymd(parts: Intl.DateTimeFormatPart[]): string {
  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;
  if (!year || !month || !day) {
    // Extremely defensive fallback — should not hit with dateStyle-like parts.
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${dd}`;
  }
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

/**
 * "Today" as YYYY-MM-DD for client UI.
 *
 * @param zone Optional IANA zone (e.g. user planning timezone). When omitted,
 * uses the browser's local calendar date (not UTC).
 */
export function clientToday(zone?: string): string {
  const now = new Date();
  if (zone) {
    try {
      const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: zone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).formatToParts(now);
      return ymd(parts);
    } catch {
      // Invalid zone — fall through to local calendar.
    }
  }
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * The last `count` calendar days ending today, oldest first.
 *
 * Both the `key` (YYYY-MM-DD, matching what the API buckets data under) and the
 * `label` (narrow weekday) are derived from the same zone-resolved day, so a
 * bar can never be drawn under another day's letter. Stepping happens on a
 * UTC-anchored calendar so a DST transition can't drop or double a day.
 *
 * @param zone Optional IANA zone (the account's planning zone). When omitted,
 * uses the browser's local calendar date.
 */
export function clientRecentDays(
  count: number,
  zone?: string,
): { key: string; label: string }[] {
  const today = clientToday(zone);
  const [y, m, d] = today.split("-").map(Number) as [number, number, number];
  const anchor = Date.UTC(y, m - 1, d);
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "narrow",
  });
  return Array.from({ length: count }, (_, i) => {
    const day = new Date(anchor - (count - 1 - i) * 86_400_000);
    return {
      key: day.toISOString().slice(0, 10),
      label: weekday.format(day),
    };
  });
}

/**
 * A UTC instant as the YYYY-MM-DD calendar day it falls on in `zone`.
 *
 * The editor needs this to show the day an occurrence actually lands on:
 * `toISOString().slice(0, 10)` names the UTC day, which is the wrong date for
 * most planning zones for part of every day.
 */
export function instantToLocalDateStr(instant: Date, zone?: string): string {
  if (zone) {
    try {
      return ymd(
        new Intl.DateTimeFormat("en-CA", {
          timeZone: zone,
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).formatToParts(instant),
      );
    } catch {
      // Invalid zone — fall through to the browser's local calendar.
    }
  }
  const y = instant.getFullYear();
  const m = String(instant.getMonth() + 1).padStart(2, "0");
  const d = String(instant.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
