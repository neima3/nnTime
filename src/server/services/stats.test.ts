/**
 * Pure unit tests for computeEstimateCalibration (Phase 6 — time-estimation
 * calibration). No DB — mirrors the pure-derivation pattern used for
 * getRemainingSec in focus.test.ts.
 */
import { describe, expect, it } from "vitest";
import { computeEstimateCalibration } from "./stats";

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
