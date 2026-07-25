import { describe, it, expect } from "vitest";
import {
  addIntention,
  intentionsProgress,
  MAX_INTENTIONS,
  MAX_INTENTION_LENGTH,
  parseIntentions,
  removeIntention,
  toggleIntention,
  writeIntentions,
  type Intention,
} from "./intentions";

const WEEK = "2026-07-20";
const OTHER_WEEK = "2026-07-13";

function blob(week: string, items: unknown[]): Record<string, unknown> {
  return { intentions: { week, items } };
}

describe("parseIntentions", () => {
  it("returns [] for missing or garbage prefs", () => {
    for (const bad of [
      undefined,
      null,
      7,
      "nope",
      [],
      {},
      { intentions: null },
      { intentions: [] },
      { intentions: { week: WEEK } },
      { intentions: { week: WEEK, items: "two" } },
    ]) {
      expect(parseIntentions(bad, WEEK)).toEqual([]);
    }
  });

  it("reads this week's aims", () => {
    const prefs = blob(WEEK, [
      { text: "move my body 3 times", done: false },
      { text: "call mum", done: true },
    ]);
    expect(parseIntentions(prefs, WEEK)).toEqual([
      { text: "move my body 3 times", done: false },
      { text: "call mum", done: true },
    ]);
  });

  it("drops last week's aims — that is the guilt-free reset", () => {
    const prefs = blob(OTHER_WEEK, [{ text: "unfinished aim", done: false }]);
    expect(parseIntentions(prefs, WEEK)).toEqual([]);
  });

  it("caps at MAX_INTENTIONS even if more were stored", () => {
    const prefs = blob(WEEK, [
      { text: "a", done: false },
      { text: "b", done: false },
      { text: "c", done: false },
      { text: "d", done: false },
    ]);
    expect(parseIntentions(prefs, WEEK)).toHaveLength(MAX_INTENTIONS);
    expect(parseIntentions(prefs, WEEK).map((i) => i.text)).toEqual(["a", "b", "c"]);
  });

  it("skips malformed entries instead of rendering blanks", () => {
    const prefs = blob(WEEK, [
      null,
      "bare string",
      { done: true },
      { text: 5 },
      { text: "   " },
      { text: "  real aim  ", done: false },
    ]);
    expect(parseIntentions(prefs, WEEK)).toEqual([{ text: "real aim", done: false }]);
  });

  it("coerces done to a strict boolean", () => {
    const prefs = blob(WEEK, [
      { text: "a", done: "true" },
      { text: "b", done: 1 },
      { text: "c", done: true },
    ]);
    expect(parseIntentions(prefs, WEEK).map((i) => i.done)).toEqual([false, false, true]);
  });

  it("truncates over-long text written by another client", () => {
    const long = "x".repeat(200);
    const [item] = parseIntentions(blob(WEEK, [{ text: long }]), WEEK);
    expect(item.text).toHaveLength(MAX_INTENTION_LENGTH);
  });

  it("requires an exact week-key match (no prefix or type coercion)", () => {
    expect(parseIntentions(blob("2026-07-2", [{ text: "a" }]), WEEK)).toEqual([]);
    expect(parseIntentions({ intentions: { week: 20260720, items: [{ text: "a" }] } }, WEEK)).toEqual(
      [],
    );
  });
});

describe("writeIntentions", () => {
  it("merges without clobbering sibling prefs", () => {
    const prefs = { quietHours: { enabled: true, start: 22, end: 7 }, transitionWarnings: true };
    const next = writeIntentions(prefs, WEEK, [{ text: "rest", done: false }]);
    expect(next.quietHours).toEqual({ enabled: true, start: 22, end: 7 });
    expect(next.transitionWarnings).toBe(true);
    expect(next.intentions).toEqual({ week: WEEK, items: [{ text: "rest", done: false }] });
  });

  it("does not mutate the input blob", () => {
    const prefs: Record<string, unknown> = { a: 1 };
    writeIntentions(prefs, WEEK, []);
    expect(prefs).toEqual({ a: 1 });
  });

  it("enforces the cap on write too", () => {
    const four = ["a", "b", "c", "d"].map((text) => ({ text, done: false }));
    const next = writeIntentions(null, WEEK, four);
    expect((next.intentions as { items: Intention[] }).items).toHaveLength(MAX_INTENTIONS);
  });

  it("round-trips through parseIntentions", () => {
    const items: Intention[] = [
      { text: "move my body 3 times", done: true },
      { text: "one slow evening", done: false },
    ];
    expect(parseIntentions(writeIntentions({}, WEEK, items), WEEK)).toEqual(items);
  });
});

describe("addIntention", () => {
  it("appends a trimmed aim", () => {
    expect(addIntention([], "  breathe  ")).toEqual([{ text: "breathe", done: false }]);
  });

  it("returns the same reference for a blank aim (nothing to save)", () => {
    const items: Intention[] = [];
    expect(addIntention(items, "   ")).toBe(items);
    expect(addIntention(items, "")).toBe(items);
  });

  it("returns the same reference at the cap", () => {
    const items = ["a", "b", "c"].map((text) => ({ text, done: false }));
    expect(addIntention(items, "d")).toBe(items);
  });

  it("refuses a case-insensitive duplicate", () => {
    const items = [{ text: "Call Mum", done: false }];
    expect(addIntention(items, "call mum")).toBe(items);
    expect(addIntention(items, "  CALL MUM ")).toBe(items);
  });

  it("truncates to the max length", () => {
    const [item] = addIntention([], "y".repeat(500));
    expect(item.text).toHaveLength(MAX_INTENTION_LENGTH);
  });

  it("does not mutate the previous array", () => {
    const items = [{ text: "a", done: false }];
    const next = addIntention(items, "b");
    expect(items).toHaveLength(1);
    expect(next).toHaveLength(2);
  });
});

describe("toggleIntention", () => {
  const items: Intention[] = [
    { text: "a", done: false },
    { text: "b", done: true },
  ];

  it("flips only the targeted aim", () => {
    expect(toggleIntention(items, 0)).toEqual([
      { text: "a", done: true },
      { text: "b", done: true },
    ]);
    expect(toggleIntention(items, 1)).toEqual([
      { text: "a", done: false },
      { text: "b", done: false },
    ]);
  });

  it("is a no-op for an out-of-range index", () => {
    expect(toggleIntention(items, -1)).toBe(items);
    expect(toggleIntention(items, 2)).toBe(items);
  });

  it("does not mutate the input", () => {
    toggleIntention(items, 0);
    expect(items[0].done).toBe(false);
  });
});

describe("removeIntention", () => {
  const items: Intention[] = [
    { text: "a", done: false },
    { text: "b", done: false },
    { text: "c", done: false },
  ];

  it("drops the targeted aim and keeps order", () => {
    expect(removeIntention(items, 1).map((i) => i.text)).toEqual(["a", "c"]);
  });

  it("frees a slot so a new aim fits", () => {
    const full = addIntention(items, "d");
    expect(full).toBe(items);
    const freed = removeIntention(items, 0);
    expect(addIntention(freed, "d").map((i) => i.text)).toEqual(["b", "c", "d"]);
  });

  it("is a no-op for an out-of-range index", () => {
    expect(removeIntention(items, 5)).toBe(items);
    expect(removeIntention(items, -2)).toBe(items);
  });
});

describe("intentionsProgress", () => {
  it("counts done vs total", () => {
    expect(
      intentionsProgress([
        { text: "a", done: true },
        { text: "b", done: false },
      ]),
    ).toEqual({ total: 2, done: 1, allDone: false });
  });

  it("reports allDone only when every aim is ticked", () => {
    expect(intentionsProgress([{ text: "a", done: true }]).allDone).toBe(true);
  });

  it("does not claim an empty week is complete", () => {
    expect(intentionsProgress([])).toEqual({ total: 0, done: 0, allDone: false });
  });
});
