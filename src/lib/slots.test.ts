import { describe, expect, it } from "vitest";
import { firstFreeSlot } from "../lib/slots";

describe("firstFreeSlot", () => {
  it("slots at the next quarter hour on an empty day", () => {
    expect(firstFreeSlot([], 13 * 60 + 7)).toBe(13 * 60 + 15);
  });

  it("skips a sliver too small to fit and lands after the busy block", () => {
    // 15:45 start, busy 16:00–16:45 → the 15-min sliver is too small.
    const busy = [{ start: 16 * 60, end: 16 * 60 + 45 }];
    expect(firstFreeSlot(busy, 15 * 60 + 34)).toBe(16 * 60 + 45);
  });

  it("takes a gap that is exactly big enough", () => {
    const busy = [{ start: 14 * 60 + 45, end: 15 * 60 }];
    expect(firstFreeSlot(busy, 14 * 60 + 10)).toBe(14 * 60 + 15);
  });

  it("chains past consecutive busy blocks", () => {
    const busy = [
      { start: 13 * 60, end: 14 * 60 },
      { start: 14 * 60, end: 15 * 60 },
    ];
    expect(firstFreeSlot(busy, 13 * 60)).toBe(15 * 60);
  });

  it("returns null when nothing fits before 22:00", () => {
    const busy = [{ start: 7 * 60, end: 21 * 60 + 45 }];
    expect(firstFreeSlot(busy, 9 * 60)).toBeNull();
  });

  it("never slots before 07:00", () => {
    expect(firstFreeSlot([], 3 * 60)).toBe(7 * 60);
  });

  it("ignores blocks already fully in the past", () => {
    const busy = [{ start: 8 * 60, end: 9 * 60 }];
    expect(firstFreeSlot(busy, 12 * 60)).toBe(12 * 60);
  });
});
