/**
 * Pure unit tests for client/shared adapters (no DB).
 */
import { describe, expect, it } from "vitest";
import {
  dateToMinutesFromMidnight,
  localMinutesToInstant,
  buildCategoryMap,
} from "./adapters";

describe("dateToMinutesFromMidnight", () => {
  it("returns 0 for UTC midnight", () => {
    const d = new Date("2026-07-15T00:00:00.000Z");
    expect(dateToMinutesFromMidnight(d, "UTC")).toBe(0);
  });

  it("returns 9*60 for 09:00 UTC", () => {
    const d = new Date("2026-07-15T09:00:00.000Z");
    expect(dateToMinutesFromMidnight(d, "UTC")).toBe(9 * 60);
  });
});

describe("localMinutesToInstant", () => {
  it("round-trips minutes in UTC", () => {
    const iso = localMinutesToInstant("2026-07-15", 9 * 60 + 30, "UTC");
    const back = dateToMinutesFromMidnight(new Date(iso), "UTC");
    expect(back).toBe(9 * 60 + 30);
  });

  it("produces a valid ISO string", () => {
    const iso = localMinutesToInstant("2026-07-15", 13 * 60, "America/New_York");
    expect(() => new Date(iso).toISOString()).not.toThrow();
    expect(new Date(iso).getTime()).not.toBeNaN();
  });
});

describe("buildCategoryMap", () => {
  it("maps known semantic keys only", () => {
    const map = buildCategoryMap([
      {
        id: "c1",
        key: "sky",
        label: "Work",
      } as never,
      {
        id: "c2",
        key: "not-a-real-key",
        label: "X",
      } as never,
    ]);
    expect(map.get("c1")).toBe("sky");
    expect(map.has("c2")).toBe(false);
  });
});
