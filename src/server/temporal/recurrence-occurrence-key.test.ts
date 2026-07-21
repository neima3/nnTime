/**
 * Pure unit tests for occurrenceKeyForIndex — the canonical way to compute a
 * stable occurrence_key for the Nth occurrence of a series without doing a
 * full day-window expansion (used for ad-hoc lookups per ADR-001). Not
 * covered by temporal.test.ts, which only exercises expandSeries directly.
 */
import { describe, expect, it } from "vitest";
import { occurrenceKeyForIndex, expandSeries } from "./recurrence";

describe("occurrenceKeyForIndex", () => {
  const dtstart = {
    year: 2024,
    month: 0, // January
    day: 1,
    hour: 9,
    minute: 0,
    second: 0,
  };

  it("index 0 equals the dtstart instant directly, without expanding", () => {
    const key = occurrenceKeyForIndex(dtstart, "UTC", "FREQ=DAILY;COUNT=5", 0);
    expect(key.toISOString()).toBe("2024-01-01T09:00:00.000Z");
  });

  it("index 0 works even for a one-off (rrule=null) series", () => {
    const key = occurrenceKeyForIndex(dtstart, "UTC", null, 0);
    expect(key.toISOString()).toBe("2024-01-01T09:00:00.000Z");
  });

  it("a non-zero index matches the corresponding entry from a full expandSeries call", () => {
    const key = occurrenceKeyForIndex(dtstart, "UTC", "FREQ=DAILY;COUNT=10", 3);
    const all = expandSeries({
      rrule: "FREQ=DAILY;COUNT=10",
      tz: "UTC",
      dtstart,
      from: new Date("2024-01-01T00:00:00Z"),
      to: new Date("2024-02-01T00:00:00Z"),
      durationMin: 30,
    });
    expect(key.toISOString()).toBe(all[3]!.occurrenceKey.toISOString());
    expect(key.toISOString()).toBe("2024-01-04T09:00:00.000Z");
  });

  it("respects the series timezone for wall-clock stability (DST-safe)", () => {
    // Index 0 in a DST-observing zone: wall time 09:00 stays 09:00 local.
    const key = occurrenceKeyForIndex(dtstart, "America/New_York", "FREQ=DAILY", 0);
    // Jan 1 2024 is EST (UTC-5): 09:00 EST = 14:00 UTC.
    expect(key.toISOString()).toBe("2024-01-01T14:00:00.000Z");
  });

  it("an out-of-range index falls back to the first occurrence", () => {
    // COUNT=2 series has only indices 0 and 1; index 5 is out of range.
    const key = occurrenceKeyForIndex(dtstart, "UTC", "FREQ=DAILY;COUNT=2", 5);
    expect(key.toISOString()).toBe("2024-01-01T09:00:00.000Z");
  });
});
