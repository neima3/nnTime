/**
 * Pure unit tests for computeEstimateCalibration, bucketEventsByZoneDate,
 * computeStreak, and computeFocusHours (Phase 6 — time-estimation
 * calibration + stats-truth zone bucketing + focus-hours strip). No DB —
 * mirrors the pure-derivation pattern used for getRemainingSec in
 * focus.test.ts.
 */
import { describe, expect, it } from "vitest";
import {
  bucketEventsByZoneDate,
  computeEstimateCalibration,
  computeFocusHours,
  computeStreak,
} from "./stats";

const DAY = 24 * 60 * 60 * 1000;
const now = new Date("2026-07-18T12:00:00.000Z");

function focusStop(
  daysAgo: number,
  targetDurationMin: number,
  elapsedMin: number,
) {
  return {
    eventType: "focus_stop",
    occurredAt: new Date(now.getTime() - daysAgo * DAY),
    payload: { state: "completed", durationMin: targetDurationMin, targetDurationMin, elapsedMin },
  };
}

describe("computeEstimateCalibration", () => {
  it("returns null with fewer than 5 qualifying sessions", () => {
    const events = [
      focusStop(1, 25, 35),
      focusStop(2, 25, 35),
      focusStop(3, 25, 35),
      focusStop(4, 25, 35),
    ];
    expect(computeEstimateCalibration(events, { now })).toBeNull();
  });

  it("computes avgTargetMin, avgActualMin, and ratio rounded to 1 decimal", () => {
    // 5 sessions: target 25 every time, actual 35 every time → ratio 1.4.
    const events = Array.from({ length: 5 }, (_, i) => focusStop(i, 25, 35));
    const result = computeEstimateCalibration(events, { now });
    expect(result).toEqual({
      sessions: 5,
      avgTargetMin: 25,
      avgActualMin: 35,
      ratio: 1.4,
    });
  });

  it("excludes focus_stop events older than the 14-day window", () => {
    const events = [
      ...Array.from({ length: 5 }, (_, i) => focusStop(i, 25, 35)),
      // Outside the 14-day window — should not affect the average.
      focusStop(20, 25, 100),
      focusStop(30, 25, 200),
    ];
    const result = computeEstimateCalibration(events, { now });
    expect(result?.sessions).toBe(5);
    expect(result?.avgActualMin).toBe(35);
  });

  it("excludes abandoned sessions under 3 actual minutes", () => {
    const events = [
      ...Array.from({ length: 5 }, (_, i) => focusStop(i, 25, 35)),
      focusStop(6, 25, 2), // abandoned — under 3 min actual
      focusStop(7, 25, 1), // abandoned
    ];
    const result = computeEstimateCalibration(events, { now });
    expect(result?.sessions).toBe(5);
    expect(result?.avgActualMin).toBe(35);
  });

  it("ignores non focus_stop events and events missing target/elapsed fields", () => {
    const events = [
      ...Array.from({ length: 5 }, (_, i) => focusStop(i, 25, 35)),
      { eventType: "complete", occurredAt: now, payload: {} },
      { eventType: "focus_stop", occurredAt: now, payload: { state: "skipped" } },
      { eventType: "focus_stop", occurredAt: now, payload: { targetDurationMin: 25 } },
    ];
    const result = computeEstimateCalibration(events, { now });
    expect(result?.sessions).toBe(5);
  });

  it("falls back to Date.now() when now is not provided", () => {
    const events = Array.from({ length: 5 }, (_, i) =>
      focusStop2(i, 25, 35),
    );
    const result = computeEstimateCalibration(events);
    expect(result?.sessions).toBe(5);
  });
});

// Helper anchored to real "now" (Date.now()), used only by the fallback test
// above so it doesn't depend on the fixed `now` constant.
function focusStop2(daysAgo: number, targetDurationMin: number, elapsedMin: number) {
  return {
    eventType: "focus_stop",
    occurredAt: new Date(Date.now() - daysAgo * DAY),
    payload: { targetDurationMin, elapsedMin },
  };
}

/* -------------------------------------------------------------------------- */
/* bucketEventsByZoneDate + computeStreak (Phase 6 — stats truth)             */
/* -------------------------------------------------------------------------- */

describe("bucketEventsByZoneDate", () => {
  it("buckets a late-evening UTC-stored event to the previous planning-zone day", () => {
    // 01:30 UTC on 2026-07-19 is 21:30 the evening before in America/New_York
    // (EDT, UTC-4) — the classic "completed the evening before, logged as the
    // wrong weekday" bug this fix targets.
    const events = [
      { eventType: "complete", occurredAt: new Date("2026-07-19T01:30:00.000Z"), payload: {} },
    ];
    const byDate = bucketEventsByZoneDate(events, "America/New_York");
    expect(byDate["2026-07-18"]?.completed).toBe(1);
    expect(byDate["2026-07-19"]).toBeUndefined();
  });

  it("buckets the same instant to the same UTC day in the UTC zone", () => {
    const events = [
      { eventType: "complete", occurredAt: new Date("2026-07-19T01:30:00.000Z"), payload: {} },
    ];
    const byDate = bucketEventsByZoneDate(events, "UTC");
    expect(byDate["2026-07-19"]?.completed).toBe(1);
  });

  it("aggregates focusMin and mood alongside completions per zone-local date", () => {
    const events = [
      { eventType: "complete", occurredAt: new Date("2026-07-19T01:30:00.000Z"), payload: {} },
      {
        eventType: "focus_stop",
        occurredAt: new Date("2026-07-19T01:45:00.000Z"),
        payload: { durationMin: 25 },
      },
      {
        eventType: "mood_checkin",
        occurredAt: new Date("2026-07-19T02:00:00.000Z"),
        payload: { mood: "good" },
      },
    ];
    const byDate = bucketEventsByZoneDate(events, "America/New_York");
    expect(byDate["2026-07-18"]).toEqual({ completed: 1, focusMin: 25, mood: "good" });
  });
});

describe("computeStreak", () => {
  it("counts a completion just after UTC midnight as today, in the planning zone", () => {
    // "now" and the completion are both 01:30Z on 2026-07-19 — 21:30 the
    // evening before in America/New_York. Bucketing (above) puts it on
    // 2026-07-18; the streak's "today" must agree, or a UTC-based "today"
    // (2026-07-19) would wrongly zero out the streak.
    const nowInstant = new Date("2026-07-19T01:30:00.000Z");
    const byDate = bucketEventsByZoneDate(
      [{ eventType: "complete", occurredAt: nowInstant, payload: {} }],
      "America/New_York",
    );
    const streak = computeStreak(byDate, "America/New_York", nowInstant);
    expect(streak.current).toBe(1);
  });

  it("still zeroes the current streak when the zone-local last-active date is older than yesterday", () => {
    const byDate = { "2026-07-01": { completed: 1 } };
    const streak = computeStreak(byDate, "America/New_York", new Date("2026-07-18T12:00:00.000Z"));
    expect(streak.current).toBe(0);
    expect(streak.best).toBe(1);
  });
});

/* -------------------------------------------------------------------------- */
/* computeFocusHours (Phase 6 — "Your focus hours" strip)                     */
/* -------------------------------------------------------------------------- */

function focusStopHour(occurredAt: Date, elapsedMin?: number) {
  return {
    eventType: "focus_stop",
    occurredAt,
    payload: elapsedMin === undefined ? {} : { elapsedMin },
  };
}

describe("computeFocusHours", () => {
  it("builds an hour histogram and reports the peak hour", () => {
    const events = [
      focusStopHour(new Date("2026-07-10T09:00:00.000Z")),
      focusStopHour(new Date("2026-07-11T09:15:00.000Z")),
      focusStopHour(new Date("2026-07-12T14:00:00.000Z")),
      focusStopHour(new Date("2026-07-13T14:10:00.000Z")),
      focusStopHour(new Date("2026-07-14T14:20:00.000Z")),
      focusStopHour(new Date("2026-07-15T20:00:00.000Z")),
    ];
    const result = computeFocusHours(events, "UTC", { now });
    expect(result).not.toBeNull();
    expect(result?.hours[9]).toBe(2);
    expect(result?.hours[14]).toBe(3);
    expect(result?.hours[20]).toBe(1);
    expect(result?.peakHour).toBe(14);
  });

  it("derives the session start hour from occurredAt minus elapsedMin when present", () => {
    // Stops at 10:15 UTC after a 90-min session → started 08:45 UTC → hour 8,
    // not the stop hour (10).
    const events = [
      focusStopHour(new Date("2026-07-10T10:15:00.000Z"), 90),
      focusStopHour(new Date("2026-07-11T10:15:00.000Z"), 90),
      focusStopHour(new Date("2026-07-12T10:15:00.000Z"), 90),
      focusStopHour(new Date("2026-07-13T10:15:00.000Z"), 90),
      focusStopHour(new Date("2026-07-14T10:15:00.000Z"), 90),
    ];
    const result = computeFocusHours(events, "UTC", { now });
    expect(result?.hours[8]).toBe(5);
    expect(result?.hours[10]).toBe(0);
    expect(result?.peakHour).toBe(8);
  });

  it("buckets by zone-local start hour: 01:30Z in America/New_York is hour 21 the previous day", () => {
    const nowInstant = new Date("2026-07-19T02:00:00.000Z");
    const events = Array.from(
      { length: 5 },
      (_, i) => focusStopHour(new Date(nowInstant.getTime() - i * 60_000 - 30 * 60_000)), // ~01:29-01:34Z, all still hour 21 NY
    );
    const result = computeFocusHours(events, "America/New_York", { now: nowInstant });
    expect(result?.hours[21]).toBe(5);
    expect(result?.peakHour).toBe(21);
  });

  it("returns null with fewer than 5 qualifying sessions", () => {
    const events = [
      focusStopHour(new Date("2026-07-10T09:00:00.000Z")),
      focusStopHour(new Date("2026-07-11T09:00:00.000Z")),
      focusStopHour(new Date("2026-07-12T09:00:00.000Z")),
      focusStopHour(new Date("2026-07-13T09:00:00.000Z")),
    ];
    expect(computeFocusHours(events, "UTC", { now })).toBeNull();
  });

  it("excludes focus_stop events older than the 30-day window", () => {
    const events = [
      ...Array.from({ length: 5 }, (_, i) => focusStopHour(new Date(now.getTime() - i * DAY))),
      focusStopHour(new Date(now.getTime() - 40 * DAY)), // outside the window
      focusStopHour(new Date(now.getTime() - 90 * DAY)), // outside the window
    ];
    const result = computeFocusHours(events, "UTC", { now });
    expect(result?.hours.reduce((a, b) => a + b, 0)).toBe(5);
  });

  it("ignores non focus_stop events", () => {
    const events = [
      ...Array.from({ length: 5 }, (_, i) => focusStopHour(new Date(now.getTime() - i * DAY))),
      { eventType: "complete", occurredAt: now, payload: {} },
    ];
    const result = computeFocusHours(events, "UTC", { now });
    expect(result?.hours.reduce((a, b) => a + b, 0)).toBe(5);
  });
});
