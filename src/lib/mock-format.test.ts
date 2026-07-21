/**
 * Pure unit tests for the fmt/fmtDuration time-formatting helpers in
 * src/lib/mock.ts (used throughout the design-reference screens for
 * "h:mm" timeline labels and "Xh Ym" duration chips).
 */
import { describe, expect, it } from "vitest";
import { fmt, fmtDuration } from "./mock";

describe("fmt", () => {
  it("formats midnight as 0:00", () => {
    expect(fmt(0)).toBe("0:00");
  });

  it("formats an hour boundary with zero-padded minutes", () => {
    expect(fmt(9 * 60)).toBe("9:00");
  });

  it("formats minutes with zero-padding under 10", () => {
    expect(fmt(9 * 60 + 5)).toBe("9:05");
  });

  it("formats a two-digit-hour time", () => {
    expect(fmt(14 * 60 + 30)).toBe("14:30");
  });

  it("formats the last minute of the day", () => {
    expect(fmt(23 * 60 + 59)).toBe("23:59");
  });

  it("wraps past 24:00 rather than clamping (no bounds-checking in the helper)", () => {
    // 25:30 → hour 25, since fmt does floor/modulo with no day wrap.
    expect(fmt(25 * 60 + 30)).toBe("25:30");
  });
});

describe("fmtDuration", () => {
  it("formats under an hour as 'N min'", () => {
    expect(fmtDuration(5)).toBe("5 min");
    expect(fmtDuration(45)).toBe("45 min");
  });

  it("formats exactly 60 minutes as 'Xh' with no minutes suffix", () => {
    expect(fmtDuration(60)).toBe("1 h");
  });

  it("formats an hour + minutes as 'Xh Ym'", () => {
    expect(fmtDuration(90)).toBe("1 h 30 min");
  });

  it("formats multiple whole hours with no remainder", () => {
    expect(fmtDuration(120)).toBe("2 h");
  });

  it("formats multiple hours with a remainder", () => {
    expect(fmtDuration(135)).toBe("2 h 15 min");
  });

  it("formats zero minutes", () => {
    expect(fmtDuration(0)).toBe("0 min");
  });

  it("formats 59 minutes as the boundary just under an hour", () => {
    expect(fmtDuration(59)).toBe("59 min");
  });
});
