import { describe, expect, it } from "vitest";
import { firstFreeSlot, suggestNewStart } from "../lib/slots";

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

describe("suggestNewStart", () => {
  it("uses 09:00 for a day that isn't today", () => {
    expect(suggestNewStart([{ start: 9 * 60, end: 10 * 60 }], null)).toBe(9 * 60);
  });

  it("never proposes a time that already passed today", () => {
    // 19:02 with nothing booked → 19:15, not the old hard-coded 13:00.
    expect(suggestNewStart([], 19 * 60 + 2)).toBe(19 * 60 + 15);
  });

  it("leaves a few minutes of runway before the next quarter hour", () => {
    expect(suggestNewStart([], 19 * 60 + 13)).toBe(19 * 60 + 30);
  });

  it("steps past whatever is happening now", () => {
    const busy = [{ start: 18 * 60 + 30, end: 19 * 60 + 20 }];
    expect(suggestNewStart(busy, 19 * 60)).toBe(19 * 60 + 30);
  });

  it("lands after the last block when no gap is big enough", () => {
    const busy = [{ start: 20 * 60, end: 23 * 60 }];
    expect(suggestNewStart(busy, 21 * 60 + 40)).toBe(23 * 60);
  });

  it("finds a real evening gap past 22:00 instead of overlapping now", () => {
    // 19:06 in a packed evening: dinner until 19:20, then back-to-back
    // blocks; the first 45-min opening is 21:30.
    const busy = [
      [1110, 1160], [1170, 1190], [1200, 1230], [1260, 1290], [1335, 1350],
    ].map(([start, end]) => ({ start: start!, end: end! }));
    expect(suggestNewStart(busy, 19 * 60 + 6)).toBe(21 * 60 + 30);
  });

  it("never goes past 23:45", () => {
    expect(suggestNewStart([{ start: 22 * 60, end: 24 * 60 }], 23 * 60)).toBe(23 * 60 + 45);
  });

  it("starts no earlier than 07:00 in the small hours", () => {
    expect(suggestNewStart([], 2 * 60)).toBe(7 * 60);
  });
});
