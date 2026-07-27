/**
 * Companion mode (T11) — the presence logic is pure and deterministic, so a
 * re-render can never flicker the copy mid-session.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  companionLine,
  readCompanionPref,
  writeCompanionPref,
  COMPANION_KEY,
  COMPANION_ROTATE_MIN,
} from "./companion";

describe("companionLine", () => {
  it("is deterministic for the same minute", () => {
    expect(companionLine(0, "running")).toBe(companionLine(0, "running"));
    expect(companionLine(7, "running")).toBe(companionLine(7, "running"));
  });

  it("holds each line for the rotation window, then moves on", () => {
    const first = companionLine(0, "running");
    expect(companionLine(COMPANION_ROTATE_MIN - 1, "running")).toBe(first);
    expect(companionLine(COMPANION_ROTATE_MIN, "running")).not.toBe(first);
  });

  it("cycles rather than running out on long sessions", () => {
    // 100 minutes in, we're back somewhere in the rotation — never undefined.
    expect(typeof companionLine(100, "running")).toBe("string");
    expect(companionLine(100, "running").length).toBeGreaterThan(0);
  });

  it("gives paused and overtime their own steady lines", () => {
    expect(companionLine(3, "paused")).toBe(companionLine(40, "paused"));
    expect(companionLine(3, "overtime")).toBe(companionLine(40, "overtime"));
    expect(companionLine(3, "paused")).not.toBe(companionLine(3, "running"));
  });

  it("never shames or urges", () => {
    for (let m = 0; m < 40; m++) {
      for (const s of ["running", "paused", "overtime"] as const) {
        const line = companionLine(m, s).toLowerCase();
        for (const word of ["hurry", "should", "behind", "faster", "focus!", "keep going"]) {
          expect(line).not.toContain(word);
        }
      }
    }
  });

  it("tolerates a negative elapsed (clock skew) without throwing", () => {
    expect(typeof companionLine(-2, "running")).toBe("string");
  });
});

describe("companion preference", () => {
  const store = new Map<string, string>();
  beforeEach(() => {
    store.clear();
    (globalThis as { localStorage?: Storage }).localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    } as unknown as Storage;
  });
  afterEach(() => {
    delete (globalThis as { localStorage?: Storage }).localStorage;
  });

  it("round-trips and defaults off", () => {
    expect(readCompanionPref()).toBe(false);
    writeCompanionPref(true);
    expect(store.get(COMPANION_KEY)).toBe("1");
    expect(readCompanionPref()).toBe(true);
    writeCompanionPref(false);
    expect(readCompanionPref()).toBe(false);
  });

  it("survives denied storage", () => {
    (globalThis as { localStorage?: Storage }).localStorage = {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      },
      removeItem: () => {
        throw new Error("denied");
      },
    } as unknown as Storage;
    expect(readCompanionPref()).toBe(false);
    expect(() => writeCompanionPref(true)).not.toThrow();
  });
});
