/**
 * Pure unit tests for day expansion — RRULE series must appear on every
 * matching day, not only the series dtstart wall date.
 */
import { describe, expect, it } from "vitest";
import {
  expandActivitiesForDay,
  type ExpandableOccurrence,
  type ExpandableSeries,
} from "./day";
import {
  resolveDayBounds,
  wallClockToInstant,
  instantToWallFields,
} from "../temporal/zone";

const TZ = "America/New_York";

function series(partial: Partial<ExpandableSeries> & Pick<ExpandableSeries, "id" | "dtstartLocal" | "title">): ExpandableSeries {
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

describe("expandActivitiesForDay", () => {
  it("DAILY series starting yesterday appears on today with correct wall start", () => {
    // Yesterday 09:00 America/New_York
    const yesterdayWall = wallClockToInstant(2026, 6, 17, 9, 0, 0, TZ);
    const todayBounds = resolveDayBounds("2026-07-18", TZ);

    const list = expandActivitiesForDay(
      [
        series({
          id: "daily-1",
          title: "Morning stretch",
          dtstartLocal: yesterdayWall,
          rrule: "FREQ=DAILY",
          durationMin: 15,
        }),
      ],
      [],
      todayBounds,
    );

    expect(list).toHaveLength(1);
    expect(list[0].title).toBe("Morning stretch");
    expect(list[0].durationMin).toBe(15);
    expect(list[0].status).toBe("pending");

    // Occurrence on today at 09:00 NY
    const wall = instantToWallFields(list[0].dtstartLocal, TZ);
    expect(wall.year).toBe(2026);
    expect(wall.month).toBe(6); // July
    expect(wall.day).toBe(18);
    expect(wall.hour).toBe(9);
    expect(wall.minute).toBe(0);

    // occurrenceKey is the original expanded start (same as start when no override)
    expect(list[0].occurrenceKey.getTime()).toBe(list[0].dtstartLocal.getTime());
    expect(list[0].occurrenceKey.toISOString()).toBe(
      wallClockToInstant(2026, 6, 18, 9, 0, 0, TZ).toISOString(),
    );
  });

  it("one-off on another day yields empty for target day", () => {
    const otherDay = wallClockToInstant(2026, 6, 15, 14, 0, 0, TZ);
    const todayBounds = resolveDayBounds("2026-07-18", TZ);

    const list = expandActivitiesForDay(
      [
        series({
          id: "one-off",
          title: "Doctor",
          dtstartLocal: otherDay,
          rrule: null,
        }),
      ],
      [],
      todayBounds,
    );

    expect(list).toHaveLength(0);
  });

  it("one-off on target day is included", () => {
    const onDay = wallClockToInstant(2026, 6, 18, 11, 30, 0, TZ);
    const todayBounds = resolveDayBounds("2026-07-18", TZ);

    const list = expandActivitiesForDay(
      [
        series({
          id: "one-off-today",
          title: "Lunch",
          dtstartLocal: onDay,
          rrule: null,
          durationMin: 45,
        }),
      ],
      [],
      todayBounds,
    );

    expect(list).toHaveLength(1);
    expect(list[0].title).toBe("Lunch");
    expect(list[0].durationMin).toBe(45);
    const wall = instantToWallFields(list[0].dtstartLocal, TZ);
    expect(wall.hour).toBe(11);
    expect(wall.minute).toBe(30);
  });

  it("occurrence override completed → status completed + field merges", () => {
    const dtstart = wallClockToInstant(2026, 6, 17, 9, 0, 0, TZ);
    const todayKey = wallClockToInstant(2026, 6, 18, 9, 0, 0, TZ);
    const todayBounds = resolveDayBounds("2026-07-18", TZ);

    const overrides: ExpandableOccurrence[] = [
      {
        seriesId: "daily-1",
        occurrenceKey: todayKey,
        status: "completed",
        title: "Morning stretch (done early)",
        durationMin: 20,
        energy: "low",
        checklistOverride: [{ label: "Stretch", done: true }],
      },
    ];

    const list = expandActivitiesForDay(
      [
        series({
          id: "daily-1",
          title: "Morning stretch",
          dtstartLocal: dtstart,
          rrule: "FREQ=DAILY",
          durationMin: 15,
          energy: "medium",
          checklistTemplate: [{ label: "Stretch", done: false }],
        }),
      ],
      overrides,
      todayBounds,
    );

    expect(list).toHaveLength(1);
    expect(list[0].status).toBe("completed");
    expect(list[0].title).toBe("Morning stretch (done early)");
    expect(list[0].durationMin).toBe(20);
    expect(list[0].energy).toBe("low");
    expect(list[0].checklistTemplate).toEqual([{ label: "Stretch", done: true }]);
    expect(list[0].occurrenceKey.toISOString()).toBe(todayKey.toISOString());
  });

  it("cancelled occurrence is omitted from the day", () => {
    const dtstart = wallClockToInstant(2026, 6, 17, 9, 0, 0, TZ);
    const todayKey = wallClockToInstant(2026, 6, 18, 9, 0, 0, TZ);
    const todayBounds = resolveDayBounds("2026-07-18", TZ);

    const list = expandActivitiesForDay(
      [
        series({
          id: "daily-1",
          title: "Morning stretch",
          dtstartLocal: dtstart,
          rrule: "FREQ=DAILY",
        }),
      ],
      [
        {
          seriesId: "daily-1",
          occurrenceKey: todayKey,
          status: "cancelled",
        },
      ],
      todayBounds,
    );

    expect(list).toHaveLength(0);
  });

  it("WEEKLY series only lands on matching weekdays", () => {
    // Start Monday 2026-07-13 10:00 NY; BYDAY=MO
    const monday = wallClockToInstant(2026, 6, 13, 10, 0, 0, TZ);
    // 2026-07-20 is Monday; 2026-07-21 is Tuesday
    const monBounds = resolveDayBounds("2026-07-20", TZ);
    const tueBounds = resolveDayBounds("2026-07-21", TZ);

    const s = series({
      id: "weekly-mo",
      title: "Team sync",
      dtstartLocal: monday,
      rrule: "FREQ=WEEKLY;BYDAY=MO",
    });

    expect(expandActivitiesForDay([s], [], monBounds)).toHaveLength(1);
    expect(expandActivitiesForDay([s], [], tueBounds)).toHaveLength(0);
  });

  it("soft-deleted series are ignored", () => {
    const dtstart = wallClockToInstant(2026, 6, 18, 9, 0, 0, TZ);
    const bounds = resolveDayBounds("2026-07-18", TZ);

    const list = expandActivitiesForDay(
      [
        series({
          id: "gone",
          title: "Deleted",
          dtstartLocal: dtstart,
          deletedAt: new Date("2026-07-01T00:00:00Z"),
        }),
      ],
      [],
      bounds,
    );

    expect(list).toHaveLength(0);
  });

  it("sorts activities by start time", () => {
    const bounds = resolveDayBounds("2026-07-18", TZ);
    const list = expandActivitiesForDay(
      [
        series({
          id: "b",
          title: "Later",
          dtstartLocal: wallClockToInstant(2026, 6, 18, 14, 0, 0, TZ),
        }),
        series({
          id: "a",
          title: "Earlier",
          dtstartLocal: wallClockToInstant(2026, 6, 18, 8, 0, 0, TZ),
        }),
      ],
      [],
      bounds,
    );

    expect(list.map((a) => a.title)).toEqual(["Earlier", "Later"]);
  });
});
