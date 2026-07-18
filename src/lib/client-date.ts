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
