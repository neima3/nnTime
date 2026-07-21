import { describe, expect, it } from "vitest";
import {
  GARDEN_MAX_BLOOMS,
  GARDEN_PER_BLOOM,
  GARDEN_STAGES,
  PEAK_MIN_SESSIONS,
  WEEKDAYS,
  focusSessionCount,
  gardenState,
  hourLabel,
  isInPeakWindow,
  reflectionNotes,
  type ReflectionInput,
} from "./insights";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

describe("constants", () => {
  it("GARDEN_STAGES has the expected thresholds in order", () => {
    expect(GARDEN_STAGES.map((s) => s.at)).toEqual([0, 3, 8, 16, 32]);
    expect(GARDEN_STAGES.map((s) => s.name)).toEqual([
      "a seed",
      "a sprout",
      "growing",
      "in bloom",
      "flourishing",
    ]);
  });

  it("GARDEN_PER_BLOOM is 3", () => {
    expect(GARDEN_PER_BLOOM).toBe(3);
  });

  it("GARDEN_MAX_BLOOMS is 24", () => {
    expect(GARDEN_MAX_BLOOMS).toBe(24);
  });

  it("PEAK_MIN_SESSIONS is 4", () => {
    expect(PEAK_MIN_SESSIONS).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// gardenState
// ---------------------------------------------------------------------------

describe("gardenState", () => {
  it("returns seed stage with 0 points and 0 blooms at (0, 0)", () => {
    const state = gardenState(0, 0);
    expect(state.points).toBe(0);
    expect(state.stageIndex).toBe(0);
    expect(state.stage.name).toBe("a seed");
    expect(state.bloomCount).toBe(0);
    expect(state.next?.name).toBe("a sprout");
    expect(state.toNext).toBe(3);
  });

  it("counts focus-only points from 25-min blocks (0 completed, 50 focusMin -> 2 points)", () => {
    const state = gardenState(0, 50);
    expect(state.points).toBe(2);
    expect(state.stage.name).toBe("a seed");
    expect(state.bloomCount).toBe(0);
    expect(state.toNext).toBe(1);
  });

  describe("stage boundaries", () => {
    it("lands exactly on seed at points=0", () => {
      const state = gardenState(0, 0);
      expect(state.points).toBe(0);
      expect(state.stage.name).toBe("a seed");
      expect(state.next?.name).toBe("a sprout");
      expect(state.toNext).toBe(3);
    });

    it("is still seed just below the sprout boundary (points=2)", () => {
      const state = gardenState(2, 0);
      expect(state.points).toBe(2);
      expect(state.stage.name).toBe("a seed");
      expect(state.next?.name).toBe("a sprout");
      expect(state.toNext).toBe(1);
    });

    it("lands exactly on sprout at points=3", () => {
      const state = gardenState(3, 0);
      expect(state.points).toBe(3);
      expect(state.stage.name).toBe("a sprout");
      expect(state.next?.name).toBe("growing");
      expect(state.toNext).toBe(5);
    });

    it("is still sprout just below the growing boundary (points=7)", () => {
      const state = gardenState(7, 0);
      expect(state.points).toBe(7);
      expect(state.stage.name).toBe("a sprout");
      expect(state.next?.name).toBe("growing");
      expect(state.toNext).toBe(1);
    });

    it("lands exactly on growing at points=8", () => {
      const state = gardenState(8, 0);
      expect(state.points).toBe(8);
      expect(state.stage.name).toBe("growing");
      expect(state.next?.name).toBe("in bloom");
      expect(state.toNext).toBe(8);
    });

    it("is still growing just below the in-bloom boundary (points=15)", () => {
      const state = gardenState(15, 0);
      expect(state.points).toBe(15);
      expect(state.stage.name).toBe("growing");
      expect(state.next?.name).toBe("in bloom");
      expect(state.toNext).toBe(1);
    });

    it("lands exactly on in bloom at points=16", () => {
      const state = gardenState(16, 0);
      expect(state.points).toBe(16);
      expect(state.stage.name).toBe("in bloom");
      expect(state.next?.name).toBe("flourishing");
      expect(state.toNext).toBe(16);
    });

    it("is still in bloom just below the flourishing boundary (points=31)", () => {
      const state = gardenState(31, 0);
      expect(state.points).toBe(31);
      expect(state.stage.name).toBe("in bloom");
      expect(state.next?.name).toBe("flourishing");
      expect(state.toNext).toBe(1);
    });

    it("lands exactly on flourishing at points=32, with next=null and toNext=0", () => {
      const state = gardenState(32, 0);
      expect(state.points).toBe(32);
      expect(state.stage.name).toBe("flourishing");
      expect(state.next).toBeNull();
      expect(state.toNext).toBe(0);
    });

    it("stays flourishing well beyond the last boundary", () => {
      const state = gardenState(200, 0);
      expect(state.stage.name).toBe("flourishing");
      expect(state.next).toBeNull();
      expect(state.toNext).toBe(0);
    });
  });

  describe("bloomCount", () => {
    it("is floor(completed / 3)", () => {
      expect(gardenState(0, 0).bloomCount).toBe(0);
      expect(gardenState(2, 0).bloomCount).toBe(0);
      expect(gardenState(3, 0).bloomCount).toBe(1);
      expect(gardenState(5, 0).bloomCount).toBe(1);
      expect(gardenState(6, 0).bloomCount).toBe(2);
    });

    it("caps at GARDEN_MAX_BLOOMS (24) for large completed counts", () => {
      const state = gardenState(100, 0);
      expect(state.bloomCount).toBe(24);
      expect(state.bloomCount).toBe(GARDEN_MAX_BLOOMS);
    });

    it("does not count focus blocks toward bloomCount", () => {
      // Lots of focus minutes but 0 completions -> 0 blooms.
      const state = gardenState(0, 10000);
      expect(state.bloomCount).toBe(0);
    });
  });

  describe("negative / fractional inputs", () => {
    it("floors and clamps negative totalCompleted to 0", () => {
      const state = gardenState(-5, 0);
      expect(state.points).toBe(0);
      expect(state.bloomCount).toBe(0);
      expect(state.stage.name).toBe("a seed");
    });

    it("floors and clamps negative totalFocusMin to 0 focus blocks", () => {
      const state = gardenState(0, -100);
      expect(state.points).toBe(0);
    });

    it("floors fractional totalCompleted", () => {
      const state = gardenState(3.7, 0);
      expect(state.points).toBe(3); // floor(3.7) = 3
      expect(state.bloomCount).toBe(1); // floor(3/3)
      expect(state.stage.name).toBe("a sprout");
    });

    it("floors fractional totalFocusMin block count", () => {
      // floor(74.9 / 25) = floor(2.996) = 2
      const state = gardenState(0, 74.9);
      expect(state.points).toBe(2);
    });

    it("clamps both negative and floors both fractional simultaneously", () => {
      const state = gardenState(-1.5, -1.5);
      expect(state.points).toBe(0);
      expect(state.bloomCount).toBe(0);
      expect(state.stage.name).toBe("a seed");
    });
  });
});

// ---------------------------------------------------------------------------
// reflectionNotes
// ---------------------------------------------------------------------------

function baseInput(overrides: Partial<ReflectionInput> = {}): ReflectionInput {
  return {
    byDate: {},
    totalCompleted: 0,
    totalFocusMin: 0,
    peakHour: null,
    ...overrides,
  };
}

describe("reflectionNotes", () => {
  it("returns [] when totalCompleted < 3", () => {
    expect(
      reflectionNotes(
        baseInput({
          totalCompleted: 2,
          totalFocusMin: 1000,
          peakHour: 10,
          byDate: {
            "2026-07-13": { completed: 2, focusMin: 0, mood: null },
          },
        }),
      ),
    ).toEqual([]);
  });

  it("returns [] at totalCompleted = 0 even with a rich byDate", () => {
    expect(
      reflectionNotes(
        baseInput({
          totalCompleted: 0,
          byDate: {
            "2026-07-13": { completed: 5, focusMin: 100, mood: "great" },
          },
        }),
      ),
    ).toEqual([]);
  });

  it("includes the weekday note only when a weekday has >=2 completions", () => {
    // Single date contributing 2 completions to its weekday.
    const withNote = reflectionNotes(
      baseInput({
        totalCompleted: 3,
        byDate: {
          "2026-07-13": { completed: 2, focusMin: 0, mood: null },
        },
      }),
    );
    const dow = new Date("2026-07-13T00:00:00").getDay();
    expect(withNote).toHaveLength(1);
    expect(withNote[0]).toContain(WEEKDAYS[dow]);

    // Multiple dates, but each weekday only ever reaches 1 completion max.
    const withoutNote = reflectionNotes(
      baseInput({
        totalCompleted: 3,
        byDate: {
          "2026-07-13": { completed: 1, focusMin: 0, mood: null },
          "2026-07-14": { completed: 1, focusMin: 0, mood: null },
          "2026-07-15": { completed: 1, focusMin: 0, mood: null },
        },
      }),
    );
    expect(withoutNote).toEqual([]);
  });

  it("ignores dates with 0 completions when bucketing by weekday", () => {
    const notes = reflectionNotes(
      baseInput({
        totalCompleted: 3,
        byDate: {
          "2026-07-13": { completed: 0, focusMin: 50, mood: null },
          "2026-07-14": { completed: 3, focusMin: 0, mood: null },
        },
      }),
    );
    const dow14 = new Date("2026-07-14T00:00:00").getDay();
    expect(notes).toHaveLength(1);
    expect(notes[0]).toContain(WEEKDAYS[dow14]);
  });

  it("includes the focus note only when totalFocusMin >= 25", () => {
    const below = reflectionNotes(
      baseInput({ totalCompleted: 3, totalFocusMin: 20 }),
    );
    expect(below.some((n) => n.includes("focused"))).toBe(false);

    const at = reflectionNotes(
      baseInput({ totalCompleted: 3, totalFocusMin: 25 }),
    );
    expect(at.some((n) => n.includes("focused"))).toBe(true);
  });

  it("uses minutes wording below 1 focused hour (25 focusMin -> minutes)", () => {
    const notes = reflectionNotes(
      baseInput({ totalCompleted: 3, totalFocusMin: 25 }),
    );
    const focusNote = notes.find((n) => n.includes("focused"));
    expect(focusNote).toContain("25 focused minutes");
    expect(focusNote).not.toContain("focused hours");
  });

  it("uses hours wording once the total crosses 1 focused hour (400 focusMin -> hours)", () => {
    const notes = reflectionNotes(
      baseInput({ totalCompleted: 3, totalFocusMin: 400 }),
    );
    const focusNote = notes.find((n) => n.includes("focused"));
    // h = round(400/6)/10 = round(66.67)/10 = 67/10 = 6.7
    expect(focusNote).toContain("6.7 focused hours");
    expect(focusNote).not.toContain("focused minutes");
  });

  it("includes the peak note only when peakHour is not null", () => {
    const withoutPeak = reflectionNotes(
      baseInput({ totalCompleted: 3, peakHour: null }),
    );
    expect(withoutPeak.some((n) => n.includes("attention lands"))).toBe(
      false,
    );

    const withPeak = reflectionNotes(
      baseInput({ totalCompleted: 3, peakHour: 9 }),
    );
    const peakNote = withPeak.find((n) => n.includes("attention lands"));
    expect(peakNote).toContain("9am");
  });

  it("includes the active-days note only when there are >= 4 distinct active days", () => {
    const threeDays = reflectionNotes(
      baseInput({
        totalCompleted: 3,
        byDate: {
          "2026-07-13": { completed: 1, focusMin: 0, mood: null },
          "2026-07-14": { completed: 1, focusMin: 0, mood: null },
          "2026-07-15": { completed: 1, focusMin: 0, mood: null },
        },
      }),
    );
    expect(threeDays.some((n) => n.includes("showed up"))).toBe(false);

    const fourDays = reflectionNotes(
      baseInput({
        totalCompleted: 3,
        byDate: {
          "2026-07-13": { completed: 1, focusMin: 0, mood: null },
          "2026-07-14": { completed: 1, focusMin: 0, mood: null },
          "2026-07-15": { completed: 1, focusMin: 0, mood: null },
          "2026-07-16": { completed: 1, focusMin: 0, mood: null },
        },
      }),
    );
    const activeNote = fourDays.find((n) => n.includes("showed up"));
    expect(activeNote).toContain("4 different days");
  });

  it("does not count zero-completion dates toward active days", () => {
    const notes = reflectionNotes(
      baseInput({
        totalCompleted: 3,
        byDate: {
          "2026-07-13": { completed: 1, focusMin: 0, mood: null },
          "2026-07-14": { completed: 1, focusMin: 0, mood: null },
          "2026-07-15": { completed: 1, focusMin: 0, mood: null },
          "2026-07-16": { completed: 0, focusMin: 0, mood: null }, // not active
        },
      }),
    );
    expect(notes.some((n) => n.includes("showed up"))).toBe(false);
  });

  it("returns notes in order: weekday, focus, peak, active-days — with all four present", () => {
    const byDate: ReflectionInput["byDate"] = {
      "2026-07-13": { completed: 3, focusMin: 0, mood: null }, // weekday winner
      "2026-07-14": { completed: 1, focusMin: 0, mood: null },
      "2026-07-15": { completed: 1, focusMin: 0, mood: null },
      "2026-07-16": { completed: 1, focusMin: 0, mood: null },
    };
    const notes = reflectionNotes(
      baseInput({
        totalCompleted: 6,
        totalFocusMin: 300,
        peakHour: 14,
        byDate,
      }),
    );

    expect(notes).toHaveLength(4);

    const dow13 = new Date("2026-07-13T00:00:00").getDay();
    expect(notes[0]).toContain(WEEKDAYS[dow13]);
    expect(notes[0]).toContain("finished");

    expect(notes[1]).toContain("focused");

    expect(notes[2]).toContain("attention lands");
    expect(notes[2]).toContain("2pm");

    expect(notes[3]).toContain("showed up");
    expect(notes[3]).toContain("4 different days");
  });

  it("uses the date string's getDay() (not UTC-shifted) for weekday bucketing", () => {
    // Two dates that fall on the same local weekday (7 days apart) should
    // accumulate into the same bucket.
    const notes = reflectionNotes(
      baseInput({
        totalCompleted: 4,
        byDate: {
          "2026-07-06": { completed: 1, focusMin: 0, mood: null },
          "2026-07-13": { completed: 1, focusMin: 0, mood: null },
        },
      }),
    );
    const dow6 = new Date("2026-07-06T00:00:00").getDay();
    const dow13 = new Date("2026-07-13T00:00:00").getDay();
    expect(dow6).toBe(dow13); // exactly one week apart -> same weekday
    expect(notes).toHaveLength(1);
    expect(notes[0]).toContain(WEEKDAYS[dow6]);
  });
});

// ---------------------------------------------------------------------------
// hourLabel
// ---------------------------------------------------------------------------

describe("hourLabel", () => {
  it("labels midnight and noon specially", () => {
    expect(hourLabel(0)).toBe("midnight");
    expect(hourLabel(12)).toBe("noon");
  });

  it("labels am/pm hours", () => {
    expect(hourLabel(9)).toBe("9am");
    expect(hourLabel(13)).toBe("1pm");
    expect(hourLabel(23)).toBe("11pm");
  });

  it("labels the remaining boundary hours", () => {
    expect(hourLabel(1)).toBe("1am");
    expect(hourLabel(11)).toBe("11am");
    expect(hourLabel(24 % 24)).toBe("midnight"); // 0
  });
});

// ---------------------------------------------------------------------------
// focusSessionCount
// ---------------------------------------------------------------------------

describe("focusSessionCount", () => {
  it("sums an array of numbers", () => {
    expect(focusSessionCount([1, 2, 3])).toBe(6);
    expect(focusSessionCount([])).toBe(0);
  });

  it("treats non-arrays, null, and undefined as 0", () => {
    expect(focusSessionCount(null)).toBe(0);
    expect(focusSessionCount(undefined)).toBe(0);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(focusSessionCount("not an array" as any)).toBe(0);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(focusSessionCount(42 as any)).toBe(0);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(focusSessionCount({} as any)).toBe(0);
  });

  it("coerces non-number array entries via Number(b) || 0", () => {
    // "2" -> 2, "abc" -> NaN -> 0, 3 -> 3
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(focusSessionCount(["2", "abc", 3] as any)).toBe(5);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(focusSessionCount([null, undefined, 1] as any)).toBe(1);
  });

  it("includes negative numbers as-is (not clamped)", () => {
    expect(focusSessionCount([5, -2])).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// isInPeakWindow
// ---------------------------------------------------------------------------

describe("isInPeakWindow", () => {
  it("is true for the hour before, of, and after the peak", () => {
    expect(isInPeakWindow(13, 14)).toBe(true);
    expect(isInPeakWindow(14, 14)).toBe(true);
    expect(isInPeakWindow(15, 14)).toBe(true);
  });

  it("is false outside the +/-1 hour window", () => {
    expect(isInPeakWindow(12, 14)).toBe(false);
    expect(isInPeakWindow(16, 14)).toBe(false);
  });
});
