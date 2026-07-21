/**
 * Pure unit tests for expandActivitiesForDay's handling of series.exdate /
 * series.rdate — not covered by day.test.ts (which only varies rrule/dtstart/
 * overrides) and distinct from temporal.test.ts's EXDATE coverage (which
 * passes exdates directly to expandSeries, not via a series row's date-only
 * exdate column + the exdatesToOccurrenceKeys conversion in day.ts).
 */
import { describe, expect, it } from "vitest";
import {
  expandActivitiesForDay,
  type ExpandableSeries,
} from "./day";
import { resolveDayBounds, wallClockToInstant } from "../temporal/zone";

const TZ = "America/New_York";

function series(
  partial: Partial<ExpandableSeries> &
    Pick<ExpandableSeries, "id" | "dtstartLocal" | "title">,
): ExpandableSeries {
  return {
    tz: TZ,
    rrule: null,
    exdate: null,
    rdate: null,
    durationMin: 30,
    energy: null,
    checklistTemplate: [],
    deletedAt: null,
    ...partial,
  };
}

describe("expandActivitiesForDay — series.exdate (date-only column)", () => {
  it("skips a daily occurrence whose calendar date is in series.exdate", () => {
    // Daily standup at 09:00 NY starting Jul 1; exclude Jul 20.
    const dtstart = wallClockToInstant(2026, 6, 1, 9, 0, 0, TZ);
    const excludedDay = resolveDayBounds("2026-07-20", TZ);
    const includedDay = resolveDayBounds("2026-07-21", TZ);

    const s = series({
      id: "daily-exdate",
      title: "Standup",
      dtstartLocal: dtstart,
      rrule: "FREQ=DAILY",
      // exdate is stored as a date-only column — midnight UTC for the calendar date.
      exdate: [new Date("2026-07-20T00:00:00.000Z")],
    });

    expect(expandActivitiesForDay([s], [], excludedDay)).toHaveLength(0);
    expect(expandActivitiesForDay([s], [], includedDay)).toHaveLength(1);
  });

  it("an invalid series.tz falls back to UTC wall fields without throwing", () => {
    const s = series({
      id: "bad-tz",
      title: "Bad TZ series",
      dtstartLocal: new Date("2026-07-18T09:00:00Z"),
      tz: "Not/AZone",
      rrule: "FREQ=DAILY",
    });
    const bounds = resolveDayBounds("2026-07-19", "UTC");
    // Should not throw — falls back to UTC wall fields for dtstart parsing;
    // rrule expansion itself still uses the (invalid) series tz, which
    // expandSeries is expected to reject gracefully (series skipped).
    expect(() => expandActivitiesForDay([s], [], bounds)).not.toThrow();
  });
});

describe("expandActivitiesForDay — series.rdate (extra one-off instances)", () => {
  it("includes an RDATE instance outside the base rrule cadence", () => {
    // Weekly Monday series, plus an ad-hoc RDATE on a Wednesday.
    const monday = wallClockToInstant(2026, 6, 13, 10, 0, 0, TZ); // 2026-07-13 is a Monday
    const extraWednesday = wallClockToInstant(2026, 6, 15, 14, 0, 0, TZ); // 2026-07-15

    const s = series({
      id: "weekly-plus-rdate",
      title: "Team sync",
      dtstartLocal: monday,
      rrule: "FREQ=WEEKLY;BYDAY=MO",
      rdate: [extraWednesday],
    });

    const wedBounds = resolveDayBounds("2026-07-15", TZ);
    const list = expandActivitiesForDay([s], [], wedBounds);
    expect(list).toHaveLength(1);
    expect(list[0]!.dtstartLocal.getTime()).toBe(extraWednesday.getTime());
  });

  it("a null entry inside rdate is filtered out rather than throwing", () => {
    const monday = wallClockToInstant(2026, 6, 13, 10, 0, 0, TZ);
    const s = series({
      id: "rdate-with-null",
      title: "Team sync",
      dtstartLocal: monday,
      rrule: "FREQ=WEEKLY;BYDAY=MO",
      // @ts-expect-error — deliberately malformed input to exercise the filter(Boolean) guard.
      rdate: [null, undefined],
    });
    const mondayBounds = resolveDayBounds("2026-07-13", TZ);
    expect(() => expandActivitiesForDay([s], [], mondayBounds)).not.toThrow();
    expect(expandActivitiesForDay([s], [], mondayBounds)).toHaveLength(1);
  });
});
