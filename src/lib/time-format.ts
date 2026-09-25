/**
 * Wall-clock time formatting, honouring the account's hour-cycle setting.
 *
 * Settings → Time has offered 12-hour/24-hour since 5B, and it was stored and
 * synced but **never consulted by anything that draws a time** — `fmt()` in
 * mock.ts hardcoded 24-hour, so the toggle did nothing on either platform.
 *
 * Must stay identical to `KTime.hhmm` in ios/App/API/Models.swift; both are
 * pinned by tests (src/lib/time-format.test.ts, ios/UnitTests/TimeFormatTests).
 */

export type HourCycle = "h12" | "h24";

/** Minutes from midnight, tolerating overnight math (25:15 → 1:15, -30 → 23:30). */
function wrap(minutes: number): number {
  if (!Number.isFinite(minutes)) return 0;
  const m = Math.trunc(minutes);
  return ((m % 1440) + 1440) % 1440;
}

/**
 * A time label:
 *   h24 → "9:00", "13:30"      (no leading zero — unchanged from before)
 *   h12 → "9:00 AM", "1:30 PM", "12:00 PM" noon, "12:15 AM" past midnight
 */
export function formatTime(minutes: number, hourCycle: HourCycle = "h24"): string {
  const total = wrap(minutes);
  const h = Math.floor(total / 60);
  const m = total % 60;
  const mm = String(m).padStart(2, "0");
  if (hourCycle === "h24") return `${h}:${mm}`;
  const suffix = h < 12 ? "AM" : "PM";
  const display = h % 12 === 0 ? 12 : h % 12;
  return `${display}:${mm} ${suffix}`;
}

/**
 * Compact label for timeline gutter marks, which repeat every hour in a narrow
 * column: "9:00" stays as-is in 24-hour, but 12-hour drops the always-zero
 * minutes ("9 AM") rather than stacking "9:00 AM" down the page.
 */
export function formatHourLabel(hour: number, hourCycle: HourCycle = "h24"): string {
  const h = ((Math.trunc(hour) % 24) + 24) % 24;
  if (hourCycle === "h24") return `${h}:00`;
  const suffix = h < 12 ? "AM" : "PM";
  const display = h % 12 === 0 ? 12 : h % 12;
  return `${display} ${suffix}`;
}

/** Narrow an unknown settings value to a HourCycle, defaulting to 24-hour. */
export function toHourCycle(value: unknown): HourCycle {
  return value === "h12" ? "h12" : "h24";
}

/**
 * Name a calendar date for a heading — "Thursday", "August 13".
 *
 * `dateStr` is already the user's local day (resolved in their planning zone),
 * so this only has to spell it out. Projecting it through a timezone can only
 * move it: building noon UTC and formatting it in the planning zone — the
 * previous approach — holds only for offsets strictly inside ±12, so at
 * UTC+12/+13 (Auckland, Chatham, Kiritimati) the heading read one day ahead of
 * the timeline beneath it. Reading the parts back in UTC is stable everywhere.
 */
export function formatDayLabel(dateStr: string): {
  dayLabel: string;
  dayDate: string;
} {
  const [year, month, day] = dateStr.split("-").map(Number);
  const named = new Date(Date.UTC(year!, month! - 1, day!));
  return {
    dayLabel: named.toLocaleDateString("en-US", {
      weekday: "long",
      timeZone: "UTC",
    }),
    dayDate: named.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      timeZone: "UTC",
    }),
  };
}

/** "45 min", "1 hr", "2 hr 5 min" — a spoken-length span for glance copy. */
export function formatSpan(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r === 0 ? `${h} hr` : `${h} hr ${r} min`;
}

/** "September 20 – 26", "Sep 28 – Oct 4", "Dec 28 – Jan 3, 2027" for YYYY-MM-DD bounds. */
export function weekRangeLabel(startStr: string, endStr: string): string {
  const s = new Date(`${startStr}T12:00:00Z`);
  const e = new Date(`${endStr}T12:00:00Z`);
  const fmt = (d: Date, month: "long" | "short") =>
    d.toLocaleDateString("en-US", { month, timeZone: "UTC" });
  const sameMonth =
    s.getUTCMonth() === e.getUTCMonth() && s.getUTCFullYear() === e.getUTCFullYear();
  if (sameMonth) return `${fmt(s, "long")} ${s.getUTCDate()} – ${e.getUTCDate()}`;
  const tail =
    s.getUTCFullYear() === e.getUTCFullYear() ? "" : `, ${e.getUTCFullYear()}`;
  return `${fmt(s, "short")} ${s.getUTCDate()} – ${fmt(e, "short")} ${e.getUTCDate()}${tail}`;
}
