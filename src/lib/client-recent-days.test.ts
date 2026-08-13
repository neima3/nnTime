/**
 * Regression tests for clientRecentDays — the chart-axis helper behind Stats'
 * "This week". The bug it exists to prevent: keys built from
 * `toISOString().slice(0, 10)` (UTC) while the server buckets completions in
 * the planning zone, so an evening in New York keys tomorrow and reads 0.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { clientRecentDays } from "./client-date";

/** The weekday letter a key *should* carry, derived from the key itself. */
function narrowWeekday(key: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "narrow",
  }).format(new Date(`${key}T00:00:00Z`));
}

afterEach(() => {
  vi.useRealTimers();
});

describe("clientRecentDays", () => {
  it("ends on the planning zone's today, not the UTC day", () => {
    // 00:30 UTC on the 13th = 20:30 on the 12th in New York.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-13T00:30:00Z"));

    const days = clientRecentDays(7, "America/New_York");

    expect(days).toHaveLength(7);
    expect(days.at(-1)!.key).toBe("2026-08-12");
    expect(days[0]!.key).toBe("2026-08-06");
    expect(days.map((d) => d.key)).not.toContain("2026-08-13");
  });

  it("ends on the zone's today when that zone is already ahead of UTC", () => {
    // 23:30 UTC on the 12th = 08:30 on the 13th in Tokyo.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-12T23:30:00Z"));

    const days = clientRecentDays(7, "Asia/Tokyo");

    expect(days.at(-1)!.key).toBe("2026-08-13");
  });

  it("labels every bar with its own key's weekday", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-13T00:30:00Z"));

    for (const day of clientRecentDays(7, "America/New_York")) {
      expect(day.label).toBe(narrowWeekday(day.key));
    }
  });

  it("steps whole calendar days across a DST transition", () => {
    // US DST begins 2026-03-08; a 23-hour local day must not drop or double.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-10T15:00:00Z"));

    const keys = clientRecentDays(7, "America/New_York").map((d) => d.key);

    expect(keys).toEqual([
      "2026-03-04",
      "2026-03-05",
      "2026-03-06",
      "2026-03-07",
      "2026-03-08",
      "2026-03-09",
      "2026-03-10",
    ]);
    expect(new Set(keys).size).toBe(7);
  });

  it("returns ascending, contiguous keys of the requested length", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-02T12:00:00Z"));

    const keys = clientRecentDays(5, "UTC").map((d) => d.key);

    expect(keys).toEqual([
      "2025-12-29",
      "2025-12-30",
      "2025-12-31",
      "2026-01-01",
      "2026-01-02",
    ]);
  });

  it("falls back to the browser's calendar day for an unknown zone", () => {
    const days = clientRecentDays(3, "Not/AZone");
    expect(days).toHaveLength(3);
    for (const day of days) expect(day.key).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
