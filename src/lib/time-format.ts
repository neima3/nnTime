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
