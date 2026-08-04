/**
 * Pure unit tests for brain-break game logic (no DOM/DB).
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildClashRound,
  buildGoSequence,
  buildMatchDeck,
  buildOddRound,
  buildSchulteGrid,
  buildTrail,
  GO_ROUNDS,
  CLASH_COLOR_NAMES,
  clearMiss,
  CONSTELLATIONS,
  pickConstellation,
  extendTrail,
  GRAMMAR_BANK,
  PROOF_BANK,
  PROOF_ROUNDS,
  isProofHit,
  buildLadder,
  LADDER_STEPS,
  pickProofRounds,
  proofCorrected,
  proofMissedItems,
  proofWords,
  makeSpan,
  MATCH_EMOJI,
  missedItems,
  ODD_PAIRS,
  ODD_ROUNDS,
  oddGridSize,
  PATTERN_GRID,
  patternShowMs,
  pickPatternTiles,
  pickQuizRounds,
  QUIZ_ROUNDS,
  quickTapAverage,
  quickTapDelayMs,
  readBest,
  readMisses,
  recordMiss,
  recordResult,
  SCHULTE_SIZE,
  schulteSeconds,
  scrambleWord,
  shuffledOddPairs,
  SOUP_BANK,
  SOUP_ROUNDS,
  pickSoupWords,
  spanShowMs,
  SPELLING_BANK,
  timeFeelFeeling,
  TRAIL_START_LENGTH,
  TRAIL_TILES,
  timeFeelRoundError,
  timeFeelScore,
  type GameId,
  type QuizItem,
} from "./games";

/** Fake localStorage for tests that need to observe reads/writes. */
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

describe("word quiz banks (GRAMMAR_BANK / SPELLING_BANK)", () => {
  const banks: [string, QuizItem[]][] = [
    ["GRAMMAR_BANK", GRAMMAR_BANK],
    ["SPELLING_BANK", SPELLING_BANK],
  ];

  it.each(banks)("%s is at least QUIZ_ROUNDS long", (_name, bank) => {
    expect(bank.length).toBeGreaterThanOrEqual(QUIZ_ROUNDS);
  });

  it.each(banks)("%s: every item's answer is included in its options", (_name, bank) => {
    for (const item of bank) {
      expect(item.options).toContain(item.answer);
    }
  });

  it.each(banks)("%s: every item's options are unique", (_name, bank) => {
    for (const item of bank) {
      expect(new Set(item.options).size).toBe(item.options.length);
    }
  });

  it.each(banks)("%s: every item has 2–3 options", (_name, bank) => {
    for (const item of bank) {
      expect(item.options.length).toBeGreaterThanOrEqual(2);
      expect(item.options.length).toBeLessThanOrEqual(3);
    }
  });

  it.each(banks)("%s: every item has a non-empty prompt and note", (_name, bank) => {
    for (const item of bank) {
      expect(item.prompt.trim().length).toBeGreaterThan(0);
      expect(item.note.trim().length).toBeGreaterThan(0);
    }
  });
});

describe("SPELLING_BANK spot check", () => {
  it("has exactly one option per item that matches the answer string (impostors differ)", () => {
    for (const item of SPELLING_BANK) {
      const matches = item.options.filter((opt) => opt === item.answer);
      expect(matches).toHaveLength(1);
      const impostors = item.options.filter((opt) => opt !== item.answer);
      for (const impostor of impostors) {
        expect(impostor).not.toBe(item.answer);
      }
    }
  });
});

describe("GRAMMAR_BANK expanded shape", () => {
  it("has at least 60 items", () => {
    expect(GRAMMAR_BANK.length).toBeGreaterThanOrEqual(60);
  });

  it("gives every item a topic", () => {
    for (const item of GRAMMAR_BANK) {
      expect(item.topic).toBeTruthy();
    }
  });

  it("spans at least 8 distinct topics", () => {
    const topics = new Set(GRAMMAR_BANK.map((item) => item.topic));
    expect(topics.size).toBeGreaterThanOrEqual(8);
  });

  it("has unique prompts (miss tracking keys off prompt identity)", () => {
    const prompts = GRAMMAR_BANK.map((item) => item.prompt);
    expect(new Set(prompts).size).toBe(prompts.length);
  });
});

describe("SPELLING_BANK prompts", () => {
  it("has unique prompts", () => {
    const prompts = SPELLING_BANK.map((item) => item.prompt);
    expect(new Set(prompts).size).toBe(prompts.length);
  });
});

describe("pickQuizRounds", () => {
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
    0.6, 0.35, 0.75, 0.45, 0.85, 0.05,
  ];

  function multiset(values: string[]): string[] {
    return [...values].sort();
  }

  it("returns QUIZ_ROUNDS items by default", () => {
    const rounds = pickQuizRounds(GRAMMAR_BANK, undefined, fakeRandom(rollsA));
    expect(rounds).toHaveLength(QUIZ_ROUNDS);
  });

  it("draws no duplicate prompts", () => {
    const rounds = pickQuizRounds(GRAMMAR_BANK, GRAMMAR_BANK.length, fakeRandom(rollsA));
    const prompts = new Set(rounds.map((r) => r.prompt));
    expect(prompts.size).toBe(rounds.length);
  });

  it("keeps each returned item's options as a permutation of the source options, answer still present", () => {
    const rounds = pickQuizRounds(GRAMMAR_BANK, GRAMMAR_BANK.length, fakeRandom(rollsA));
    for (const round of rounds) {
      const source = GRAMMAR_BANK.find((item) => item.prompt === round.prompt);
      expect(source).toBeDefined();
      expect(multiset(round.options)).toEqual(multiset(source!.options));
      expect(round.options).toContain(round.answer);
      expect(round.answer).toBe(source!.answer);
    }
  });

  it("is deterministic for a seeded fake random", () => {
    const first = pickQuizRounds(GRAMMAR_BANK, QUIZ_ROUNDS, fakeRandom(rollsA));
    const second = pickQuizRounds(GRAMMAR_BANK, QUIZ_ROUNDS, fakeRandom(rollsA));
    expect(second).toEqual(first);
  });

  it("caps at the bank length when requesting more than available", () => {
    const rounds = pickQuizRounds(SPELLING_BANK, 1000, fakeRandom(rollsA));
    expect(rounds).toHaveLength(SPELLING_BANK.length);
  });

  it("does not mutate the source bank arrays", () => {
    const beforeGrammar = JSON.stringify(GRAMMAR_BANK);
    const beforeSpelling = JSON.stringify(SPELLING_BANK);
    pickQuizRounds(GRAMMAR_BANK, GRAMMAR_BANK.length, fakeRandom(rollsA));
    pickQuizRounds(SPELLING_BANK, SPELLING_BANK.length, fakeRandom(rollsA));
    expect(JSON.stringify(GRAMMAR_BANK)).toBe(beforeGrammar);
    expect(JSON.stringify(SPELLING_BANK)).toBe(beforeSpelling);
  });

  function topicCounts(rounds: QuizItem[]): number[] {
    const counts = new Map<string, number>();
    for (const r of rounds) {
      const topic = r.topic ?? "general";
      counts.set(topic, (counts.get(topic) ?? 0) + 1);
    }
    return [...counts.values()];
  }

  it("never draws more than the default cap (2) of one topic — several seeded randoms and live Math.random", () => {
    const seeds: number[][] = [
      rollsA,
      [0.05, 0.9, 0.2, 0.85, 0.1, 0.7, 0.15, 0.75, 0.3, 0.6, 0.4, 0.5, 0.95, 0.65, 0.8],
      [0.99, 0.01, 0.5, 0.33, 0.67, 0.1, 0.9, 0.4, 0.6, 0.2],
      [0.123, 0.456, 0.789, 0.234, 0.567, 0.891, 0.012, 0.345],
    ];
    for (const rolls of seeds) {
      const rounds = pickQuizRounds(GRAMMAR_BANK, QUIZ_ROUNDS, fakeRandom(rolls));
      expect(rounds).toHaveLength(QUIZ_ROUNDS);
      expect(Math.max(...topicCounts(rounds))).toBeLessThanOrEqual(2);
    }

    // Live Math.random, repeated — the guarantee has to hold for any draw,
    // not just seeded ones.
    for (let i = 0; i < 20; i++) {
      const rounds = pickQuizRounds(GRAMMAR_BANK);
      expect(rounds).toHaveLength(QUIZ_ROUNDS);
      expect(Math.max(...topicCounts(rounds))).toBeLessThanOrEqual(2);
    }
  });

  it("does not enforce the topic cap when maxPerTopic is set high", () => {
    // random() => 0 always turns the Fisher-Yates shuffle into a fixed
    // rotate-by-one, so the first 8 picks are GRAMMAR_BANK[1..8] — all
    // "homophones" (indices 0-15). With maxPerTopic: 99 nothing stops that.
    const zeroRandom = () => 0;
    const rounds = pickQuizRounds(GRAMMAR_BANK, QUIZ_ROUNDS, zeroRandom, { maxPerTopic: 99 });
    expect(rounds).toHaveLength(QUIZ_ROUNDS);
    expect(Math.max(...topicCounts(rounds))).toBeGreaterThan(2);
  });

  it("fills any shortfall so the draw still hits the requested count", () => {
    // Synthetic pool: one topic with 7 items (over the default cap of 2)
    // and one topic with a single item — 8 items total.
    const syntheticBank: QuizItem[] = [
      ...Array.from({ length: 7 }, (_, i) => ({
        topic: "a",
        prompt: `synthetic a${i}`,
        options: ["x", "y"],
        answer: "x",
        note: "n",
      })),
      { topic: "b", prompt: "synthetic b0", options: ["x", "y"], answer: "x", note: "n" },
    ];
    const rounds = pickQuizRounds(syntheticBank, 8, fakeRandom(rollsA));
    expect(rounds).toHaveLength(8);
    // The cap-respecting first pass alone could only supply 3 (2 of "a" + 1
    // of "b"); the shortfall-fill pass must have topped up the rest from "a".
    const aCount = rounds.filter((r) => r.topic === "a").length;
    expect(aCount).toBeGreaterThan(2);
  });
});

describe("miss tracking (recordMiss / clearMiss / readMisses / missedItems)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const id: GameId = "grammar-snap";

  it("dedupes a re-missed prompt and keeps it newest-last", () => {
    vi.stubGlobal("localStorage", new FakeStorage());
    recordMiss(id, "A");
    recordMiss(id, "B");
    expect(readMisses(id)).toEqual(["A", "B"]);

    recordMiss(id, "A"); // re-miss: moves to the end, no duplicate entry
    expect(readMisses(id)).toEqual(["B", "A"]);
  });

  it("caps the miss list at 40, dropping the oldest first", () => {
    vi.stubGlobal("localStorage", new FakeStorage());
    for (let i = 0; i < 45; i++) {
      recordMiss(id, `prompt-${i}`);
    }
    const misses = readMisses(id);
    expect(misses).toHaveLength(40);
    expect(misses[0]).toBe("prompt-5");
    expect(misses[misses.length - 1]).toBe("prompt-44");
    expect(misses).not.toContain("prompt-0");
  });

  it("clearMiss removes a redeemed prompt", () => {
    vi.stubGlobal("localStorage", new FakeStorage());
    recordMiss(id, "A");
    recordMiss(id, "B");
    clearMiss(id, "A");
    expect(readMisses(id)).toEqual(["B"]);
  });

  it("readMisses returns [] on invalid JSON", () => {
    const storage = new FakeStorage();
    storage.setItem("kairo-play-misses-grammar-snap", "not json{{{");
    vi.stubGlobal("localStorage", storage);
    expect(readMisses(id)).toEqual([]);
  });

  it("readMisses returns [] when storage throws", () => {
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
    expect(readMisses(id)).toEqual([]);
  });

  it("missedItems maps stored prompts back to bank items in stored order, skipping unknowns", () => {
    const p0 = GRAMMAR_BANK[0]!.prompt;
    const p5 = GRAMMAR_BANK[5]!.prompt;
    const items = missedItems(GRAMMAR_BANK, [p5, "not-a-real-prompt", p0]);
    expect(items.map((i) => i.prompt)).toEqual([p5, p0]);
  });
});

describe("buildSchulteGrid", () => {
  it("contains exactly 1..25 once each", () => {
    const grid = buildSchulteGrid();
    expect([...grid].sort((a, b) => a - b)).toEqual(
      Array.from({ length: SCHULTE_SIZE }, (_, i) => i + 1),
    );
  });

  it("shuffles deterministically from a seeded RNG", () => {
    let calls = 0;
    const seeded = () => {
      calls += 1;
      return (calls * 0.37) % 1;
    };
    const a = buildSchulteGrid(seeded);
    calls = 0;
    const b = buildSchulteGrid(seeded);
    expect(a).toEqual(b);
    expect(a).not.toEqual(buildSchulteGrid(() => 0));
  });
});

describe("schulteSeconds", () => {
  it("rounds elapsed ms to one decimal second", () => {
    expect(schulteSeconds(43_240)).toBe(43.2);
    expect(schulteSeconds(43_260)).toBe(43.3);
    expect(schulteSeconds(60_000)).toBe(60);
  });

  it("floors at a tenth of a second", () => {
    expect(schulteSeconds(0)).toBe(0.1);
    expect(schulteSeconds(20)).toBe(0.1);
  });
});

describe("extendTrail / buildTrail", () => {
  it("starts with TRAIL_START_LENGTH tiles in range", () => {
    const trail = buildTrail();
    expect(trail).toHaveLength(TRAIL_START_LENGTH);
    for (const t of trail) {
      expect(t).toBeGreaterThanOrEqual(0);
      expect(t).toBeLessThan(TRAIL_TILES);
    }
  });

  it("never repeats the same tile twice in a row", () => {
    // Force the raw roll to collide with the previous tile every time.
    let trail = [4];
    for (let i = 0; i < 50; i++) {
      const collide = () => 4 / TRAIL_TILES + 0.001;
      trail = extendTrail(trail, collide);
      expect(trail[trail.length - 1]).not.toBe(trail[trail.length - 2]);
    }
  });

  it("extends by exactly one tile without mutating the input", () => {
    const start = [1, 2, 3];
    const next = extendTrail(start, () => 0.9);
    expect(start).toEqual([1, 2, 3]);
    expect(next).toHaveLength(4);
    expect(next.slice(0, 3)).toEqual(start);
  });
});

describe("buildClashRound", () => {
  it("returns indexes within the color set", () => {
    for (let i = 0; i < 100; i++) {
      const r = buildClashRound();
      expect(r.word).toBeGreaterThanOrEqual(0);
      expect(r.word).toBeLessThan(CLASH_COLOR_NAMES.length);
      expect(r.ink).toBeGreaterThanOrEqual(0);
      expect(r.ink).toBeLessThan(CLASH_COLOR_NAMES.length);
    }
  });

  it("is congruent when the congruence roll is under 0.25", () => {
    const rolls = [0.5, 0.1]; // word=2, congruent
    const r = buildClashRound(() => rolls.shift() ?? 0);
    expect(r.word).toBe(2);
    expect(r.ink).toBe(2);
  });

  it("is incongruent otherwise, never mapping ink onto the word", () => {
    for (let shift = 0; shift < 30; shift++) {
      const rolls = [0.5, 0.9, (shift % 3) / 3];
      const r = buildClashRound(() => rolls.shift() ?? 0);
      expect(r.ink).not.toBe(r.word);
    }
  });
});

describe("odd one out", () => {
  it("shuffles pairs deterministically without losing any", () => {
    let calls = 0;
    const seeded = () => {
      calls += 1;
      return (calls * 0.31) % 1;
    };
    const a = shuffledOddPairs(seeded);
    expect(a).toHaveLength(ODD_PAIRS.length);
    expect(new Set(a.map((p) => p[0]))).toEqual(
      new Set(ODD_PAIRS.map((p) => p[0])),
    );
    calls = 0;
    expect(shuffledOddPairs(seeded)).toEqual(a);
  });

  it("grows the grid 3x3 → 4x4 → 5x5 across rounds", () => {
    expect([0, 1, 2].map(oddGridSize)).toEqual([3, 3, 3]);
    expect([3, 4, 5].map(oddGridSize)).toEqual([4, 4, 4]);
    expect([6, 7].map(oddGridSize)).toEqual([5, 5]);
  });

  it("builds a round whose impostor differs from the crowd and fits the grid", () => {
    for (let round = 0; round < ODD_ROUNDS; round++) {
      const r = buildOddRound(round, ODD_PAIRS[0]!);
      expect(r.base).not.toBe(r.odd);
      expect([ODD_PAIRS[0]![0], ODD_PAIRS[0]![1]]).toContain(r.base);
      expect(r.size).toBe(oddGridSize(round));
      expect(r.oddIndex).toBeGreaterThanOrEqual(0);
      expect(r.oddIndex).toBeLessThan(r.size * r.size);
    }
  });

  it("flips which twin is the impostor based on the first roll", () => {
    const low = buildOddRound(0, ODD_PAIRS[0]!, () => 0.1);
    expect(low.base).toBe(ODD_PAIRS[0]![1]);
    expect(low.odd).toBe(ODD_PAIRS[0]![0]);
    const rolls = [0.9, 0.5];
    const high = buildOddRound(0, ODD_PAIRS[0]!, () => rolls.shift() ?? 0);
    expect(high.base).toBe(ODD_PAIRS[0]![0]);
    expect(high.odd).toBe(ODD_PAIRS[0]![1]);
  });
});

describe("digit span", () => {
  it("makes a span of the requested length from digits only", () => {
    const span = makeSpan(7);
    expect(span).toHaveLength(7);
    expect(span).toMatch(/^[0-9]+$/);
  });

  it("never repeats a digit immediately", () => {
    // A roll that would repeat the previous digit every time.
    const same = () => 0.45; // floor(4.5) = 4 each round
    const span = makeSpan(20, same);
    for (let i = 1; i < span.length; i++) {
      expect(span[i]).not.toBe(span[i - 1]);
    }
  });

  it("scales visible time with length", () => {
    expect(spanShowMs(3)).toBe(1950);
    expect(spanShowMs(8)).toBe(3700);
    expect(spanShowMs(4)).toBeGreaterThan(spanShowMs(3));
  });
});

describe("green light (go / no-go)", () => {
  it("builds a full-length plan that always starts in motion", () => {
    const seq = buildGoSequence();
    expect(seq).toHaveLength(GO_ROUNDS);
    expect(seq[0]).toBe(true);
    expect(seq[1]).toBe(true);
  });

  it("never allows three no-gos in a row, even when the RNG insists", () => {
    const seq = buildGoSequence(() => 0); // every optional roll says no-go
    for (let i = 2; i < seq.length; i++) {
      expect(seq[i - 2] || seq[i - 1] || seq[i]).toBe(true);
    }
    expect(seq.some((go) => !go)).toBe(true);
  });

  it("is all go when the RNG never rolls under the no-go band", () => {
    expect(buildGoSequence(() => 0.9).every(Boolean)).toBe(true);
  });

  it("keeps the no-go share meaningful for a mid RNG", () => {
    const seq = buildGoSequence(() => 0.1);
    const noGos = seq.filter((go) => !go).length;
    expect(noGos).toBeGreaterThanOrEqual(6);
  });
});

describe("night sky", () => {
  it("keeps every star inside the canvas", () => {
    for (const c of CONSTELLATIONS) {
      expect(c.points.length).toBeGreaterThanOrEqual(5);
      for (const [x, y] of c.points) {
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThanOrEqual(1);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(y).toBeLessThanOrEqual(1);
      }
    }
  });

  it("names every constellation uniquely", () => {
    const names = CONSTELLATIONS.map((c) => c.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("picks deterministically and in range", () => {
    expect(pickConstellation(() => 0)).toBe(0);
    expect(pickConstellation(() => 0.999999)).toBe(CONSTELLATIONS.length - 1);
    expect(pickConstellation(() => 0.5)).toBe(
      Math.floor(0.5 * CONSTELLATIONS.length),
    );
  });
});

describe("letter soup", () => {
  it("keeps the bank anagram-safe in shape: 5-6 letter lowercase words", () => {
    for (const word of SOUP_BANK) {
      expect(word).toMatch(/^[a-z]{5,6}$/);
    }
    expect(new Set(SOUP_BANK).size).toBe(SOUP_BANK.length);
  });

  it("guards the curation: no two bank words are anagrams of each other", () => {
    const keys = SOUP_BANK.map((w) => w.split("").sort().join(""));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("draws eight distinct words deterministically", () => {
    let calls = 0;
    const seeded = () => {
      calls += 1;
      return (calls * 0.23) % 1;
    };
    const a = pickSoupWords(seeded);
    expect(a).toHaveLength(SOUP_ROUNDS);
    expect(new Set(a).size).toBe(SOUP_ROUNDS);
    calls = 0;
    expect(pickSoupWords(seeded)).toEqual(a);
  });

  it("scrambles to the same multiset of letters, never the original order", () => {
    for (const word of SOUP_BANK) {
      const scrambled = scrambleWord(word);
      expect(scrambled.join("")).not.toBe(word);
      expect([...scrambled].sort()).toEqual(word.split("").sort());
    }
  });

  it("escapes a pathological RNG via rotation", () => {
    // A "shuffle" that always swaps an index with itself changes nothing —
    // the rotation fallback must still produce a different order.
    const identity = () => 0.999999;
    const out = scrambleWord("candle", identity);
    expect(out.join("")).not.toBe("candle");
    expect([...out].sort()).toEqual("candle".split("").sort());
  });
});

describe("pattern tiles", () => {
  it("draws the requested count of distinct in-grid tiles, sorted", () => {
    for (const count of [3, 5, 9]) {
      const tiles = pickPatternTiles(count);
      expect(tiles).toHaveLength(count);
      expect(new Set(tiles).size).toBe(count);
      expect([...tiles].sort((a, b) => a - b)).toEqual(tiles);
      for (const t of tiles) {
        expect(t).toBeGreaterThanOrEqual(0);
        expect(t).toBeLessThan(PATTERN_GRID);
      }
    }
  });

  it("caps the draw at the grid size", () => {
    expect(pickPatternTiles(99)).toHaveLength(PATTERN_GRID);
  });

  it("is deterministic for a seeded RNG", () => {
    let calls = 0;
    const seeded = () => {
      calls += 1;
      return (calls * 0.31) % 1;
    };
    const a = pickPatternTiles(5, seeded);
    calls = 0;
    expect(pickPatternTiles(5, seeded)).toEqual(a);
  });

  it("scales visible time with the pattern size", () => {
    expect(patternShowMs(3)).toBe(1650);
    expect(patternShowMs(9)).toBe(3150);
  });
});

describe("proof it (find the wrong word)", () => {
  it("bank integrity: exactly one in-range, fixable error per sentence", () => {
    const seen = new Set<string>();
    for (const item of PROOF_BANK) {
      const words = proofWords(item);
      expect(words.length).toBeGreaterThanOrEqual(5);
      expect(item.errorIndex).toBeGreaterThanOrEqual(0);
      expect(item.errorIndex).toBeLessThan(words.length);
      expect(words[item.errorIndex]).not.toBe(item.fix);
      if (item.fix === "") {
        // Deletion entries are doubled words — the twin sits right before.
        expect(words[item.errorIndex - 1]).toBe(words[item.errorIndex]);
      }
      expect(item.note.trim().length).toBeGreaterThan(0);
      expect(seen.has(item.text)).toBe(false);
      seen.add(item.text);
    }
    expect(PROOF_BANK.length).toBeGreaterThanOrEqual(40);
  });

  it("corrects the sentence by swapping only the wrong word", () => {
    const item = PROOF_BANK[0]!;
    const corrected = proofCorrected(item).split(" ");
    const original = proofWords(item);
    expect(corrected).toHaveLength(original.length);
    expect(corrected[item.errorIndex]).toBe(item.fix);
    for (let i = 0; i < original.length; i++) {
      if (i !== item.errorIndex) expect(corrected[i]).toBe(original[i]);
    }
  });

  it("corrects doubled words by dropping one twin", () => {
    const doubled = PROOF_BANK.filter((i) => i.fix === "");
    expect(doubled.length).toBeGreaterThanOrEqual(3);
    for (const item of doubled) {
      const corrected = proofCorrected(item).split(" ");
      expect(corrected).toHaveLength(proofWords(item).length - 1);
      expect(corrected.join(" ")).not.toContain(
        `${corrected[item.errorIndex - 1]} ${corrected[item.errorIndex - 1]}`,
      );
    }
  });

  it("counts either twin as a hit, exact index otherwise", () => {
    const doubled = PROOF_BANK.find((i) => i.fix === "")!;
    expect(isProofHit(doubled, doubled.errorIndex)).toBe(true);
    expect(isProofHit(doubled, doubled.errorIndex - 1)).toBe(true);
    expect(isProofHit(doubled, doubled.errorIndex + 1)).toBe(false);
    const plain = PROOF_BANK[0]!;
    expect(isProofHit(plain, plain.errorIndex)).toBe(true);
    expect(isProofHit(plain, plain.errorIndex + 1)).toBe(false);
  });

  it("picks 8 rounds with at most two per topic", () => {
    let calls = 0;
    const seeded = () => {
      calls += 1;
      return (calls * 0.137) % 1;
    };
    const rounds = pickProofRounds(PROOF_BANK, PROOF_ROUNDS, seeded);
    expect(rounds).toHaveLength(PROOF_ROUNDS);
    const perTopic = new Map<string, number>();
    for (const r of rounds) {
      perTopic.set(r.topic, (perTopic.get(r.topic) ?? 0) + 1);
    }
    for (const count of perTopic.values()) {
      expect(count).toBeLessThanOrEqual(2);
    }
    expect(new Set(rounds.map((r) => r.text)).size).toBe(PROOF_ROUNDS);
  });

  it("is deterministic for a seeded RNG", () => {
    let calls = 0;
    const seeded = () => {
      calls += 1;
      return (calls * 0.271) % 1;
    };
    const a = pickProofRounds(PROOF_BANK, PROOF_ROUNDS, seeded).map((r) => r.text);
    calls = 0;
    const b = pickProofRounds(PROOF_BANK, PROOF_ROUNDS, seeded).map((r) => r.text);
    expect(b).toEqual(a);
  });

  it("lifts the topic cap when the pool is small (practice runs)", () => {
    const pool = PROOF_BANK.filter((i) => i.topic === "spelling");
    const rounds = pickProofRounds(pool, 4, Math.random, { maxPerTopic: 99 });
    expect(rounds).toHaveLength(4);
  });


  it("cross-platform seeded pin — iOS ArcadeLogic must match this exact draw", () => {
    let calls = 0;
    const seeded = () => {
      calls += 1;
      return (calls * 0.137) % 1;
    };
    expect(pickProofRounds(PROOF_BANK, PROOF_ROUNDS, seeded).map((r) => r.text)).toEqual([
      "I could of finished it with ten more minutes.",
      "Whos turn is it to water the plants?",
      "That was a wierd way to end a meeting.",
      "I think that that plan needs one more step.",
      "Neither of the routes are faster at rush hour.",
      "The dog wagged it's tail at every stranger.",
      "It happend again right after the reset.",
      "The Smiths dog knows everyone on the street.",
    ]);
  });

  it("filters the practice pool by missed texts", () => {
    const misses = [PROOF_BANK[0]!.text, PROOF_BANK[5]!.text, "not-in-bank"];
    const pool = proofMissedItems(PROOF_BANK, misses);
    expect(pool.map((i) => i.text)).toEqual([
      PROOF_BANK[0]!.text,
      PROOF_BANK[5]!.text,
    ]);
  });
});

describe("number ladder", () => {
  const seeded = (mult: number) => {
    let calls = 0;
    return () => {
      calls += 1;
      return (calls * mult) % 1;
    };
  };

  it("builds 6 rungs with the correct running chain", () => {
    for (const mult of [0.137, 0.271, 0.319, 0.457, 0.611]) {
      const ladder = buildLadder(seeded(mult));
      expect(ladder.steps).toHaveLength(LADDER_STEPS);
      let value = ladder.start;
      for (const step of ladder.steps) {
        if (step.op === "\u00d72") expect(step.result).toBe(value * 2);
        else if (step.op.startsWith("+"))
          expect(step.result).toBe(value + Number(step.op.slice(1)));
        else expect(step.result).toBe(value - Number(step.op.slice(1)));
        value = step.result;
      }
    }
  });

  it("keeps every value inside 0..99 with exactly one correct option", () => {
    for (const mult of [0.137, 0.271, 0.319, 0.457, 0.611, 0.733]) {
      const ladder = buildLadder(seeded(mult));
      expect(ladder.start).toBeGreaterThanOrEqual(3);
      expect(ladder.start).toBeLessThanOrEqual(12);
      for (const step of ladder.steps) {
        expect(step.result).toBeGreaterThanOrEqual(0);
        expect(step.result).toBeLessThanOrEqual(99);
        expect(step.options).toHaveLength(3);
        expect(step.options).toContain(step.result);
        expect(new Set(step.options).size).toBe(3);
        for (const opt of step.options) {
          expect(opt).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });

  it("is deterministic for a seeded RNG", () => {
    const a = buildLadder(seeded(0.271));
    const b = buildLadder(seeded(0.271));
    expect(b).toEqual(a);
  });

  it("cross-platform seeded pin — iOS ArcadeLogic must match this ladder", () => {
    const ladder = buildLadder(seeded(0.137));
    expect(ladder.start).toBe(4);
    expect(ladder.steps.map((s) => s.op)).toEqual([
      "+5", "\u00d72", "\u22122", "\u22129", "+7", "+6",
    ]);
    expect(ladder.steps.map((s) => s.result)).toEqual([9, 18, 16, 7, 14, 20]);
    expect(ladder.steps.map((s) => s.options)).toEqual([
      [9, 11, 6], [18, 16, 20], [16, 15, 17], [8, 6, 7], [17, 11, 14], [22, 20, 17],
    ]);
  });
});
