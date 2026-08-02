import { describe, expect, it } from "vitest";
import { normalizeFocusDuration } from "./focus-duration";

describe("normalizeFocusDuration", () => {
  it.each([
    ["15", 15],
    ["60", 60],
    ["1440", 1440],
  ])("accepts a bounded whole-minute duration %s", (value, expected) => {
    expect(normalizeFocusDuration(value)).toBe(expected);
  });

  it.each([
    undefined,
    ["25"],
    "0",
    "-1",
    "1.5",
    "Infinity",
    "1e999",
    "1441",
    "not-a-number",
  ])("falls back for unsafe duration %j", (value) => {
    expect(normalizeFocusDuration(value)).toBe(25);
  });
});
