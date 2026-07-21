/**
 * Pure edge-case tests for getRemainingSec (ADR-004) not covered by
 * focus.test.ts's "pure derivation" describe block: overtime (session runs
 * past its target — ADR-004 says it stays running rather than
 * auto-completing), the exact-zero-remaining boundary, and a zero-minute
 * target. No DB needed.
 */
import { describe, expect, it } from "vitest";
import { getRemainingSec } from "./focus";

const MIN = 60 * 1000;
const t0 = Date.UTC(2026, 0, 1, 12, 0, 0);

describe("getRemainingSec overtime (ADR-004: stays running past target)", () => {
  it("returns a negative remaining once elapsed exceeds the target", () => {
    const remaining = getRemainingSec(
      {
        state: "running",
        startedAt: new Date(t0),
        targetDurationMin: 25,
        accumulatedPauseSec: 0,
        currentIntervalStartedAt: new Date(t0),
      },
      t0 + 30 * MIN, // 5 min into overtime
    );
    expect(remaining).toBe(-5 * 60);
  });

  it("stays negative and keeps counting down further into overtime", () => {
    const session = {
      state: "running" as const,
      startedAt: new Date(t0),
      targetDurationMin: 10,
      accumulatedPauseSec: 0,
      currentIntervalStartedAt: new Date(t0),
    };
    expect(getRemainingSec(session, t0 + 15 * MIN)).toBe(-5 * 60);
    expect(getRemainingSec(session, t0 + 20 * MIN)).toBe(-10 * 60);
  });

  it("a paused session frozen in overtime still reports the negative remaining", () => {
    const session = {
      state: "paused" as const,
      startedAt: new Date(t0),
      targetDurationMin: 10,
      accumulatedPauseSec: 0,
      // Paused 15 min in — already 5 min over target.
      currentIntervalStartedAt: new Date(t0 + 15 * MIN),
    };
    expect(getRemainingSec(session, t0 + 60 * MIN)).toBe(-5 * 60);
  });
});

describe("getRemainingSec boundaries", () => {
  it("returns exactly 0 the instant elapsed equals the target", () => {
    const remaining = getRemainingSec(
      {
        state: "running",
        startedAt: new Date(t0),
        targetDurationMin: 25,
        accumulatedPauseSec: 0,
        currentIntervalStartedAt: new Date(t0),
      },
      t0 + 25 * MIN,
    );
    expect(remaining).toBe(0);
  });

  it("a zero-minute target is immediately overtime", () => {
    const remaining = getRemainingSec(
      {
        state: "running",
        startedAt: new Date(t0),
        targetDurationMin: 0,
        accumulatedPauseSec: 0,
        currentIntervalStartedAt: new Date(t0),
      },
      t0,
    );
    expect(remaining).toBe(0);
    expect(
      getRemainingSec(
        {
          state: "running",
          startedAt: new Date(t0),
          targetDurationMin: 0,
          accumulatedPauseSec: 0,
          currentIntervalStartedAt: new Date(t0),
        },
        t0 + 1000,
      ),
    ).toBe(-1);
  });

  it("a session with more accumulated pause than elapsed wall time reports remaining beyond the raw target (pause fully excluded)", () => {
    // 10 min wall since start, but 10 min of that was already paused before this
    // interval — 0 min of actual focus elapsed, so remaining == full target.
    const remaining = getRemainingSec(
      {
        state: "running",
        startedAt: new Date(t0),
        targetDurationMin: 25,
        accumulatedPauseSec: 10 * 60,
        currentIntervalStartedAt: new Date(t0 + 10 * MIN),
      },
      t0 + 10 * MIN,
    );
    expect(remaining).toBe(25 * 60);
  });
});
