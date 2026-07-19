/**
 * Pure unit tests for brain-break game logic (no DOM/DB).
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildMatchDeck,
  MATCH_EMOJI,
  quickTapAverage,
  quickTapDelayMs,
  readBest,
  recordResult,
  timeFeelFeeling,
  timeFeelRoundError,
  timeFeelScore,
} from "./games";

describe("timeFeelRoundError", () => {
  it("returns the exact absolute error percentage", () => {
    expect(timeFeelRoundError(10, 15)).toBeCloseTo(0.5);
    expect(timeFeelRoundError(10, 5)).toBeCloseTo(0.5);
    expect(timeFeelRoundError(20, 20)).toBe(0);
  });

  it("guards against a zero (or negative) target", () => {
    expect(timeFeelRoundError(0, 5)).toBe(0);
    expect(timeFeelRoundError(-1, 5)).toBe(0);
  });
});

describe("timeFeelScore", () => {
  it("scores perfect rounds as 100", () => {
    expect(
      timeFeelScore([
        { targetSec: 5, actualSec: 5 },
        { targetSec: 12, actualSec: 12 },
      ]),
    ).toBe(100);
  });

  it("computes the mean-error score (50% + 0% error → 75)", () => {
    expect(
      timeFeelScore([
        { targetSec: 10, actualSec: 15 },
        { targetSec: 10, actualSec: 10 },
      ]),
    ).toBe(75);
  });

  it("floors the score at 0 for wild errors", () => {
    expect(
      timeFeelScore([{ targetSec: 5, actualSec: 100 }]),
    ).toBe(0);
  });

  it("returns 0 for an empty round list", () => {
    expect(timeFeelScore([])).toBe(0);
  });
});

describe("timeFeelFeeling", () => {
  it("is spot-on within ±8% error", () => {
    expect(timeFeelFeeling(10, 10)).toBe("spot-on");
    expect(timeFeelFeeling(100, 107)).toBe("spot-on");
    expect(timeFeelFeeling(100, 93)).toBe("spot-on");
  });

  it("is fast when the guess comes in under the target", () => {
    expect(timeFeelFeeling(10, 8)).toBe("fast");
  });

  it("is slow when the guess comes in over the target", () => {
    expect(timeFeelFeeling(10, 12)).toBe("slow");
  });
});

describe("quickTapAverage", () => {
  it("averages valid rounds and ignores nulls", () => {
    expect(quickTapAverage([100, null, 200, null, 300])).toBe(200);
  });

  it("returns null when every round is null", () => {
    expect(quickTapAverage([null, null, null])).toBeNull();
  });

  it("rounds the average", () => {
    // (100 + 101) / 2 = 100.5 -> rounds to 101
    expect(quickTapAverage([100, 101])).toBe(101);
  });
});

describe("quickTapDelayMs", () => {
  it("maps roll 0 to the 1200ms floor", () => {
    expect(quickTapDelayMs(0)).toBe(1200);
  });

  it("maps a roll near 1 to at most 3500ms", () => {
    expect(quickTapDelayMs(0.999999)).toBeLessThanOrEqual(3500);
  });

  it("is monotonically increasing in roll", () => {
    const a = quickTapDelayMs(0.1);
    const b = quickTapDelayMs(0.5);
    const c = quickTapDelayMs(0.9);
    expect(a).toBeLessThan(b);
    expect(b).toBeLessThan(c);
  });
});

describe("buildMatchDeck", () => {
  /** Deterministic fake RNG: replays a fixed roll sequence. */
  function fakeRandom(rolls: number[]): () => number {
    let i = 0;
    return () => {
      const v = rolls[i % rolls.length]!;
      i += 1;
      return v;
    };
  }

  const rollsA = [
    0.9, 0.1, 0.7, 0.05, 0.55, 0.3, 0.8, 0.2, 0.65, 0.4, 0.15, 0.95, 0.5, 0.25,
    0.6,
  ];
  const rollsB = [
    0.05, 0.9, 0.2, 0.85, 0.1, 0.7, 0.15, 0.75, 0.3, 0.6, 0.4, 0.5, 0.95, 0.65,
    0.8,
  ];

  it("builds a 16-card deck", () => {
    expect(buildMatchDeck(fakeRandom(rollsA))).toHaveLength(16);
  });

  it("includes every emoji exactly twice", () => {
    const deck = buildMatchDeck(fakeRandom(rollsA));
    for (const emoji of MATCH_EMOJI) {
      expect(deck.filter((c) => c === emoji)).toHaveLength(2);
    }
  });

  it("is deterministic for a given roll sequence", () => {
    const first = buildMatchDeck(fakeRandom(rollsA));
    const second = buildMatchDeck(fakeRandom(rollsA));
    expect(second).toEqual(first);
  });

  it("produces a different permutation for a different roll sequence", () => {
    const a = buildMatchDeck(fakeRandom(rollsA));
    const b = buildMatchDeck(fakeRandom(rollsB));
    expect(b).not.toEqual(a);
  });
});

describe("readBest / recordResult (mocked localStorage)", () => {
  class FakeStorage implements Storage {
    private store = new Map<string, string>();
    get length() {
      return this.store.size;
    }
    clear(): void {
      this.store.clear();
    }
    getItem(key: string): string | null {
      return this.store.has(key) ? this.store.get(key)! : null;
    }
    key(index: number): string | null {
      return Array.from(this.store.keys())[index] ?? null;
    }
    removeItem(key: string): void {
      this.store.delete(key);
    }
    setItem(key: string, value: string): void {
      this.store.set(key, value);
    }
  }

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps the max for a 'high' direction game", () => {
    vi.stubGlobal("localStorage", new FakeStorage());
    expect(recordResult("time-feel", 60, "high")).toBe(true);
    expect(readBest("time-feel")).toBe(60);

    expect(recordResult("time-feel", 40, "high")).toBe(false);
    expect(readBest("time-feel")).toBe(60);

    expect(recordResult("time-feel", 90, "high")).toBe(true);
    expect(readBest("time-feel")).toBe(90);
  });

  it("keeps the min for a 'low' direction game", () => {
    vi.stubGlobal("localStorage", new FakeStorage());
    expect(recordResult("quick-tap", 300, "low")).toBe(true);
    expect(readBest("quick-tap")).toBe(300);

    expect(recordResult("quick-tap", 400, "low")).toBe(false);
    expect(readBest("quick-tap")).toBe(300);

    expect(recordResult("quick-tap", 150, "low")).toBe(true);
    expect(readBest("quick-tap")).toBe(150);
  });

  it("accumulates a 'count' game and always reports not-a-new-best", () => {
    vi.stubGlobal("localStorage", new FakeStorage());
    expect(recordResult("steady-breath", 3, "count")).toBe(false);
    expect(readBest("steady-breath")).toBe(3);

    expect(recordResult("steady-breath", 2, "count")).toBe(false);
    expect(readBest("steady-breath")).toBe(5);
  });

  it("returns null for an invalid stored value", () => {
    const storage = new FakeStorage();
    storage.setItem("kairo-play-best-emoji-match", "not-a-number");
    vi.stubGlobal("localStorage", storage);
    expect(readBest("emoji-match")).toBeNull();
  });

  it("fails safe (null/false) when storage throws", () => {
    const throwing: Storage = {
      length: 0,
      clear: () => {
        throw new Error("blocked");
      },
      getItem: () => {
        throw new Error("blocked");
      },
      key: () => null,
      removeItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    vi.stubGlobal("localStorage", throwing);
    expect(readBest("time-feel")).toBeNull();
    expect(recordResult("time-feel", 50, "high")).toBe(false);
  });
});
