import { describe, it, expect } from "vitest";
import {
  A11Y_CLASSES,
  A11Y_CLASS_PAIRS,
  A11Y_DEFAULTS,
  A11Y_STORAGE_KEY,
  ALL_A11Y_CLASSES,
  a11yClassList,
  applyA11yPrefs,
  deserializeA11yPrefs,
  parseA11yPrefs,
  serializeA11yPrefs,
  writeA11yPrefs,
  type A11yPrefs,
} from "./a11y-prefs";

/** Minimal stand-in for DOMTokenList — keeps these tests jsdom-free. */
function fakeClassList(initial: string[] = []) {
  const set = new Set(initial);
  return {
    add: (...tokens: string[]) => tokens.forEach((t) => set.add(t)),
    remove: (...tokens: string[]) => tokens.forEach((t) => set.delete(t)),
    has: (token: string) => set.has(token),
    tokens: () => [...set].sort(),
  };
}

const ALL_ON: A11yPrefs = {
  reducedStimulation: true,
  highContrast: true,
  dyslexiaFont: true,
  largerText: true,
};

describe("parseA11yPrefs", () => {
  it("defaults every mode to off for missing/garbage input", () => {
    for (const bad of [undefined, null, 5, "nope", [], {}, { notificationPrefs: [] }]) {
      expect(parseA11yPrefs(bad)).toEqual(A11Y_DEFAULTS);
    }
  });

  it("reads reducedStimulation from the column and the rest from notificationPrefs", () => {
    expect(
      parseA11yPrefs({
        reducedStimulation: true,
        notificationPrefs: { highContrast: true, dyslexiaFont: false, largerText: true },
      }),
    ).toEqual({
      reducedStimulation: true,
      highContrast: true,
      dyslexiaFont: false,
      largerText: true,
    });
  });

  it("only accepts a literal true — a truthy blob never forces a mode on", () => {
    const parsed = parseA11yPrefs({
      reducedStimulation: 1,
      notificationPrefs: { highContrast: "yes", dyslexiaFont: {}, largerText: [1] },
    });
    expect(parsed).toEqual(A11Y_DEFAULTS);
  });

  it("ignores unrelated notificationPrefs keys", () => {
    const parsed = parseA11yPrefs({
      notificationPrefs: { quietHours: { enabled: true }, intentions: { week: "x", items: [] } },
    });
    expect(parsed).toEqual(A11Y_DEFAULTS);
  });
});

describe("a11yClassList", () => {
  it("lists only the enabled modes", () => {
    expect(a11yClassList(A11Y_DEFAULTS)).toEqual([]);
    expect(a11yClassList({ ...A11Y_DEFAULTS, highContrast: true })).toEqual(["high-contrast"]);
    expect(a11yClassList(ALL_ON)).toEqual([
      "reduced-stimulation",
      "high-contrast",
      "dyslexia-font",
      "larger-text",
    ]);
  });
});

describe("applyA11yPrefs", () => {
  it("adds the enabled classes", () => {
    const cl = fakeClassList();
    applyA11yPrefs({ ...A11Y_DEFAULTS, dyslexiaFont: true }, cl);
    expect(cl.tokens()).toEqual(["dyslexia-font"]);
  });

  it("removes the modes that are now off (turning a mode back off works)", () => {
    const cl = fakeClassList(ALL_A11Y_CLASSES);
    applyA11yPrefs(A11Y_DEFAULTS, cl);
    expect(cl.tokens()).toEqual([]);
  });

  it("leaves classes it does not own alone", () => {
    const cl = fakeClassList(["dark", "font-onest"]);
    applyA11yPrefs(ALL_ON, cl);
    expect(cl.has("dark")).toBe(true);
    expect(cl.has("font-onest")).toBe(true);
  });

  it("is idempotent", () => {
    const cl = fakeClassList();
    applyA11yPrefs(ALL_ON, cl);
    applyA11yPrefs(ALL_ON, cl);
    expect(cl.tokens()).toEqual([...ALL_A11Y_CLASSES].sort());
  });
});

describe("serialize / deserialize", () => {
  it("round-trips every combination", () => {
    const flags = [true, false];
    for (const reducedStimulation of flags)
      for (const highContrast of flags)
        for (const dyslexiaFont of flags)
          for (const largerText of flags) {
            const prefs = { reducedStimulation, highContrast, dyslexiaFont, largerText };
            expect(deserializeA11yPrefs(serializeA11yPrefs(prefs))).toEqual(prefs);
          }
  });

  it("stores nothing for all-off", () => {
    expect(serializeA11yPrefs(A11Y_DEFAULTS)).toBe("");
  });

  it("tolerates junk, unknown tokens, whitespace, and null", () => {
    expect(deserializeA11yPrefs(null)).toEqual(A11Y_DEFAULTS);
    expect(deserializeA11yPrefs("")).toEqual(A11Y_DEFAULTS);
    expect(deserializeA11yPrefs("someOldFlag,,,")).toEqual(A11Y_DEFAULTS);
    expect(deserializeA11yPrefs(" largerText , highContrast ")).toEqual({
      ...A11Y_DEFAULTS,
      largerText: true,
      highContrast: true,
    });
  });
});

describe("writeA11yPrefs", () => {
  it("writes the three presentation extras and leaves siblings intact", () => {
    const prefs = { quietHours: { enabled: true, start: 22, end: 7 }, transitionWarnings: true };
    const next = writeA11yPrefs(prefs, ALL_ON);
    expect(next.quietHours).toEqual({ enabled: true, start: 22, end: 7 });
    expect(next.transitionWarnings).toBe(true);
    expect(next.highContrast).toBe(true);
    expect(next.dyslexiaFont).toBe(true);
    expect(next.largerText).toBe(true);
  });

  it("never writes reducedStimulation into the blob — it is its own column", () => {
    expect(writeA11yPrefs({}, ALL_ON)).not.toHaveProperty("reducedStimulation");
  });

  it("does not mutate the input blob", () => {
    const prefs: Record<string, unknown> = { a: 1 };
    writeA11yPrefs(prefs, ALL_ON);
    expect(prefs).toEqual({ a: 1 });
  });

  it("round-trips through parseA11yPrefs", () => {
    const notificationPrefs = writeA11yPrefs(null, ALL_ON);
    expect(parseA11yPrefs({ reducedStimulation: true, notificationPrefs })).toEqual(ALL_ON);
  });
});

describe("class name contract", () => {
  it("keeps the storage tokens and class names paired for the inline script", () => {
    expect(A11Y_CLASS_PAIRS).toEqual([
      ["reducedStimulation", "reduced-stimulation"],
      ["highContrast", "high-contrast"],
      ["dyslexiaFont", "dyslexia-font"],
      ["largerText", "larger-text"],
    ]);
  });

  it("uses the tokens serializeA11yPrefs actually writes", () => {
    const stored = serializeA11yPrefs(ALL_ON).split(",");
    for (const [token] of A11Y_CLASS_PAIRS) expect(stored).toContain(token);
  });

  it("pins the storage key the inline script reads", () => {
    expect(A11Y_STORAGE_KEY).toBe("kairo-a11y");
  });

  it("has one class per pref, all kebab-case", () => {
    expect(ALL_A11Y_CLASSES).toHaveLength(Object.keys(A11Y_CLASSES).length);
    for (const cls of ALL_A11Y_CLASSES) expect(cls).toMatch(/^[a-z]+(-[a-z]+)*$/);
  });
});
