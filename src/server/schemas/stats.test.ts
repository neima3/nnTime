import { describe, expect, it } from "vitest";
import {
  moodCheckinRequest,
  moodCheckinResponse,
  statsQuery,
  statsResponse,
} from "./stats";

function validStats() {
  return {
    byDate: {
      "2026-07-28": { completed: 3, focusMin: 45, mood: "good" },
    },
    streak: { current: 2, best: 8 },
    energyBalance: { low: 1, medium: 2, high: 3 },
    totalCompleted: 3,
    totalFocusMin: 45,
    estimate: {
      sessions: 5,
      avgTargetMin: 20,
      avgActualMin: 25,
      ratio: 1.3,
    },
    focusHours: {
      hours: Array.from({ length: 24 }, (_, hour) => (hour === 9 ? 4 : 0)),
      peakHour: 9,
    },
    energyPattern: {
      byHour: Array.from({ length: 24 }, (_, hour) => (hour === 10 ? 5 : 0)),
      sampled: 8,
      window: { start: 9, end: 12 },
    },
    from: "2026-07-14T12:00:00.000Z",
    to: "2026-07-28T12:00:00.000Z",
    days: 14,
  };
}

describe("stats query contract", () => {
  it("defaults to 14 days", () => {
    expect(statsQuery.parse({})).toEqual({ days: 14 });
  });

  it.each([
    ["1", 1],
    ["90", 90],
    [14, 14],
  ])("accepts bounded integer days %s", (input, expected) => {
    expect(statsQuery.parse({ days: input })).toEqual({ days: expected });
  });

  it.each(["not-a-number", "1.5", "0", "-1", "91", ""])(
    "rejects invalid days %s",
    (days) => {
      expect(statsQuery.safeParse({ days }).success).toBe(false);
    },
  );
});

describe("stats response contract", () => {
  it("accepts the complete aggregate response", () => {
    expect(statsResponse.parse(validStats())).toEqual(validStats());
  });

  it("accepts evidence-gated nullable insights", () => {
    const base = validStats();
    const stats = {
      ...base,
      estimate: null,
      focusHours: null,
      energyPattern: { ...base.energyPattern, window: null },
    };

    expect(statsResponse.safeParse(stats).success).toBe(true);
  });

  it("rejects malformed hour vectors and negative counts", () => {
    const base = validStats();
    const shortHours = {
      ...base,
      focusHours: { ...base.focusHours, hours: [1, 2] },
    };
    expect(statsResponse.safeParse(shortHours).success).toBe(false);

    const negative = { ...base, totalCompleted: -1 };
    expect(statsResponse.safeParse(negative).success).toBe(false);
  });

  it("rejects an unknown mood in a day aggregate", () => {
    const base = validStats();
    const stats = {
      ...base,
      byDate: {
        "2026-07-28": {
          ...base.byDate["2026-07-28"],
          mood: "excited",
        },
      },
    };
    expect(statsResponse.safeParse(stats).success).toBe(false);
  });
});

describe("mood check-in contract", () => {
  it.each(["low", "okay", "good", "great"])(
    "accepts the closed mood value %s",
    (mood) => {
      expect(moodCheckinRequest.parse({ mood })).toEqual({ mood });
    },
  );

  it("accepts an optional note up to 500 characters", () => {
    expect(
      moodCheckinRequest.safeParse({ mood: "good", note: "x".repeat(500) })
        .success,
    ).toBe(true);
  });

  it("rejects unknown moods and overlong notes", () => {
    expect(moodCheckinRequest.safeParse({ mood: "excellent" }).success).toBe(
      false,
    );
    expect(
      moodCheckinRequest.safeParse({ mood: "good", note: "x".repeat(501) })
        .success,
    ).toBe(false);
  });

  it("requires the exact acknowledgement", () => {
    expect(moodCheckinResponse.parse({ ok: true })).toEqual({ ok: true });
    expect(moodCheckinResponse.safeParse({ ok: false }).success).toBe(false);
  });
});
