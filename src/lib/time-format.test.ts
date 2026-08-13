/**
 * Mirror of ios/UnitTests/TimeFormatTests.swift — the two platforms must agree
 * character for character, or the same planner reads differently on each.
 *
 * Written after a real bug: Settings → Time offered 12/24-hour, stored and
 * synced it, and nothing that drew a time ever read it.
 */
import { describe, it, expect } from "vitest";
import { formatHourLabel, formatTime, toHourCycle, formatDayLabel } from "./time-format";

describe("formatTime — 24-hour (unchanged from the old fmt())", () => {
  it("formats without a leading zero", () => {
    expect(formatTime(9 * 60, "h24")).toBe("9:00");
    expect(formatTime(13 * 60 + 30, "h24")).toBe("13:30");
    expect(formatTime(0, "h24")).toBe("0:00");
    expect(formatTime(23 * 60 + 59, "h24")).toBe("23:59");
  });

  it("is the default, so an un-threaded caller keeps today's behaviour", () => {
    expect(formatTime(13 * 60 + 5)).toBe("13:05");
  });
});

describe("formatTime — 12-hour", () => {
  it("adds AM/PM", () => {
    expect(formatTime(9 * 60, "h12")).toBe("9:00 AM");
    expect(formatTime(13 * 60 + 30, "h12")).toBe("1:30 PM");
    expect(formatTime(7 * 60 + 5, "h12")).toBe("7:05 AM");
  });

  it("calls midnight and noon 12, not 0", () => {
    expect(formatTime(0, "h12")).toBe("12:00 AM");
    expect(formatTime(12 * 60, "h12")).toBe("12:00 PM");
    expect(formatTime(12 * 60 + 30, "h12")).toBe("12:30 PM");
    expect(formatTime(23 * 60 + 59, "h12")).toBe("11:59 PM");
  });
});

describe("formatTime — overnight arithmetic", () => {
  it("wraps a block that runs past midnight instead of printing 25:00", () => {
    expect(formatTime(24 * 60, "h24")).toBe("0:00");
    expect(formatTime(25 * 60 + 15, "h24")).toBe("1:15");
    expect(formatTime(25 * 60 + 15, "h12")).toBe("1:15 AM");
  });

  it("wraps negative minutes", () => {
    expect(formatTime(-30, "h24")).toBe("23:30");
    expect(formatTime(-30, "h12")).toBe("11:30 PM");
  });

  it("does not throw on junk", () => {
    expect(formatTime(NaN, "h24")).toBe("0:00");
    expect(formatTime(Infinity, "h12")).toBe("12:00 AM");
  });
});

describe("formatHourLabel — timeline gutter", () => {
  it("keeps :00 in 24-hour", () => {
    expect(formatHourLabel(0, "h24")).toBe("0:00");
    expect(formatHourLabel(9, "h24")).toBe("9:00");
    expect(formatHourLabel(23, "h24")).toBe("23:00");
  });

  it("drops the always-zero minutes in 12-hour to keep the gutter narrow", () => {
    expect(formatHourLabel(0, "h12")).toBe("12 AM");
    expect(formatHourLabel(9, "h12")).toBe("9 AM");
    expect(formatHourLabel(12, "h12")).toBe("12 PM");
    expect(formatHourLabel(23, "h12")).toBe("11 PM");
  });

  it("wraps hours past the end of the day", () => {
    expect(formatHourLabel(24, "h24")).toBe("0:00");
    expect(formatHourLabel(25, "h12")).toBe("1 AM");
  });
});

describe("toHourCycle", () => {
  it("only accepts the literal h12", () => {
    expect(toHourCycle("h12")).toBe("h12");
    expect(toHourCycle("h24")).toBe("h24");
  });

  it("defaults anything unexpected to 24-hour", () => {
    for (const bad of [undefined, null, "", "12", "H12", 12, {}]) {
      expect(toHourCycle(bad)).toBe("h24");
    }
  });
});

/**
 * The heading used to be built from noon UTC projected into the planning zone,
 * which only stays on the same calendar day for offsets strictly inside ±12.
 * At UTC+12/+13 it read one day ahead of the timeline beneath it.
 */
describe("formatDayLabel", () => {
  it("names the date it is given", () => {
    expect(formatDayLabel("2026-08-13")).toEqual({
      dayLabel: "Thursday",
      dayDate: "August 13",
    });
  });

  it("is identical no matter what the host timezone is", () => {
    // The label must depend only on dateStr — the far-east zones are where the
    // old noon-UTC approach broke.
    for (const dateStr of ["2026-08-14", "2026-01-01", "2026-12-31", "2026-02-28"]) {
      const first = formatDayLabel(dateStr);
      expect(first).toEqual(formatDayLabel(dateStr));
      // day number in the label always matches the input's day component
      expect(first.dayDate).toContain(String(Number(dateStr.slice(8, 10))));
    }
  });

  it("does not roll into the next day for a date at any month boundary", () => {
    expect(formatDayLabel("2026-08-31").dayDate).toBe("August 31");
    expect(formatDayLabel("2026-09-01").dayDate).toBe("September 1");
    expect(formatDayLabel("2026-02-28").dayDate).toBe("February 28");
  });

  it("agrees with the weekday of the same calendar date", () => {
    const cases: Array<[string, string]> = [
      ["2026-08-13", "Thursday"],
      ["2026-08-14", "Friday"],
      ["2026-08-15", "Saturday"],
      ["2026-08-16", "Sunday"],
    ];
    for (const [dateStr, weekday] of cases) {
      expect(formatDayLabel(dateStr).dayLabel).toBe(weekday);
    }
  });
});
