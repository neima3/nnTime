/**
 * Pins the "what time is it" rule for client surfaces (ADR-001).
 *
 * Written after a real bug: the Daily Brief's morning card, the peak-focus
 * nudge, the Anytime "slot it" cursor and the current-activity ring all read
 * `new Date().getHours()` — the DEVICE clock. An Auckland planner opened on a
 * New York laptop was told "Good morning" at 6pm and had its now-ring parked
 * 16 hours away from the timeline. Same family as the Today-heading bug that
 * `formatDayLabel` fixed.
 *
 * Every assertion uses a FIXED UTC instant, so these can never go flaky and
 * never depend on the machine's TZ (except the explicit fallback cases, which
 * compare against the host zone rather than a hard-coded one).
 */
import { describe, expect, it } from "vitest";
import { isMorningInZone, nowHourInZone, nowMinutesInZone } from "./client-now";

const AKL = "Pacific/Auckland";
const NYC = "America/New_York";

/** 2026-08-13 22:35 UTC → Auckland Fri 14th 10:35 (NZST +12), NY Thu 13th 18:35 (EDT −4). */
const EVENING_IN_NY = new Date("2026-08-13T22:35:00Z");
/** 2026-08-13 08:00 UTC → NY 04:00 (EDT −4), Auckland 20:00 (NZST +12). */
const PREDAWN_IN_NY = new Date("2026-08-13T08:00:00Z");
/** 2026-01-13 22:35 UTC → Auckland is on NZDT (+13) here, NY on EST (−5). */
const SOUTHERN_SUMMER = new Date("2026-01-13T22:35:00Z");

describe("nowMinutesInZone — the same instant is a different time of day per zone", () => {
  it("projects one UTC instant into each planning zone's own minutes-from-midnight", () => {
    expect(nowMinutesInZone(AKL, EVENING_IN_NY)).toBe(10 * 60 + 35); // 635
    expect(nowMinutesInZone(NYC, EVENING_IN_NY)).toBe(18 * 60 + 35); // 1115
  });

  it("keeps the 16-hour NZST/EDT gap between the two (wrapping past midnight)", () => {
    const akl = nowMinutesInZone(AKL, EVENING_IN_NY);
    const nyc = nowMinutesInZone(NYC, EVENING_IN_NY);
    expect((akl - nyc + 1440) % 1440).toBe(16 * 60);
  });

  it("tracks DST on both sides — in January the gap is 18 hours (NZDT vs EST)", () => {
    expect(nowMinutesInZone(AKL, SOUTHERN_SUMMER)).toBe(11 * 60 + 35);
    expect(nowMinutesInZone(NYC, SOUTHERN_SUMMER)).toBe(17 * 60 + 35);
    const akl = nowMinutesInZone(AKL, SOUTHERN_SUMMER);
    const nyc = nowMinutesInZone(NYC, SOUTHERN_SUMMER);
    expect((akl - nyc + 1440) % 1440).toBe(18 * 60);
  });

  it("stays inside a single day's worth of minutes", () => {
    for (const zone of [AKL, NYC, "UTC", "Asia/Kolkata", "Pacific/Kiritimati"]) {
      const min = nowMinutesInZone(zone, EVENING_IN_NY);
      expect(min).toBeGreaterThanOrEqual(0);
      expect(min).toBeLessThan(1440);
    }
  });

  it("handles a half-hour offset zone (Kolkata is UTC+5:30)", () => {
    // 22:35Z + 5:30 = 04:05 next day.
    expect(nowMinutesInZone("Asia/Kolkata", EVENING_IN_NY)).toBe(4 * 60 + 5);
  });
});

describe("nowHourInZone", () => {
  it("returns the zone-local hour, not the device hour", () => {
    expect(nowHourInZone(AKL, EVENING_IN_NY)).toBe(10);
    expect(nowHourInZone(NYC, EVENING_IN_NY)).toBe(18);
  });
});

describe("isMorningInZone — the Daily Brief / greeting predicate", () => {
  it("is true in Auckland and false in New York for the same instant", () => {
    expect(isMorningInZone(AKL, EVENING_IN_NY)).toBe(true);
    expect(isMorningInZone(NYC, EVENING_IN_NY)).toBe(false);
  });

  it("flips the other way at a different instant — neither zone is privileged", () => {
    expect(isMorningInZone(NYC, PREDAWN_IN_NY)).toBe(true);
    expect(isMorningInZone(AKL, PREDAWN_IN_NY)).toBe(false);
  });

  it("uses noon as the boundary in the planning zone", () => {
    // 2026-08-13T15:59:59Z = 11:59 EDT (morning) / 16:00 UTC (not).
    const justBeforeNoonNy = new Date("2026-08-13T15:59:00Z");
    expect(isMorningInZone(NYC, justBeforeNoonNy)).toBe(true);
    expect(isMorningInZone("UTC", justBeforeNoonNy)).toBe(false);
  });
});

describe("browser-local fallback (documented — LiveNowLine convention)", () => {
  const hostZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  it("falls back to the device clock when no zone is given", () => {
    expect(nowMinutesInZone(undefined, EVENING_IN_NY)).toBe(
      nowMinutesInZone(hostZone, EVENING_IN_NY),
    );
  });

  it("treats an empty zone string (signed-out / demo planner) as no zone", () => {
    expect(nowMinutesInZone("", EVENING_IN_NY)).toBe(
      nowMinutesInZone(hostZone, EVENING_IN_NY),
    );
    expect(isMorningInZone("", EVENING_IN_NY)).toBe(
      isMorningInZone(hostZone, EVENING_IN_NY),
    );
  });

  it("never throws on a bogus zone — falls back instead", () => {
    expect(() => nowMinutesInZone("Not/AZone", EVENING_IN_NY)).not.toThrow();
    expect(nowMinutesInZone("Not/AZone", EVENING_IN_NY)).toBe(
      nowMinutesInZone(hostZone, EVENING_IN_NY),
    );
  });

  it("defaults the instant to now when not injected", () => {
    const min = nowMinutesInZone(AKL);
    expect(min).toBeGreaterThanOrEqual(0);
    expect(min).toBeLessThan(1440);
  });
});
