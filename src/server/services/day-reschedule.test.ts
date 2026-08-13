/**
 * "Move to tomorrow" — day bucketing for rescheduled occurrences.
 *
 * The bug: expandActivitiesForDay selected instances by their ORIGINAL expanded
 * occurrence_key and only then applied override.startAt for display. A
 * this-occurrence reschedule (Review → "Move to tomorrow") therefore stayed on
 * the old day showing the new clock time, and never appeared on the new day.
 */
import { describe, expect, it } from "vitest";
import { expandActivitiesForDay } from "./day";
import { resolveDayBounds } from "../temporal/zone";

const ZONE = "America/New_York";
const SERIES_ID = "11111111-1111-4111-8111-111111111111";

/** 09:00 local on the given day, as a UTC instant. */
function at9am(dateStr: string): Date {
  const bounds = resolveDayBounds(dateStr, ZONE);
  return new Date(bounds.start.getTime() + 9 * 60 * 60 * 1000);
}

function series(overrides: Record<string, unknown> = {}) {
  return {
    id: SERIES_ID,
    userId: "u1",
    tz: ZONE,
    dtstartLocal: at9am("2026-08-13"),
    rrule: null,
    exdate: null,
    rdate: null,
    title: "Deep work",
    emoji: null,
    categoryId: null,
    durationMin: 60,
    checklistTemplate: null,
    energy: null,
    priority: null,
    tags: null,
    notes: null,
    source: "manual",
    sourceRef: null,
    revision: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

function movedToTomorrow() {
  return {
    seriesId: SERIES_ID,
    // key stays on the original day — that is what a "this occurrence" edit does
    occurrenceKey: at9am("2026-08-13"),
    startAt: at9am("2026-08-14"),
    status: "pending",
    durationMin: null,
    title: null,
    energy: null,
    checklistOverride: null,
    deletedAt: null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

describe("a this-occurrence reschedule moves the activity between days", () => {
  it("removes it from the original day", () => {
    const today = resolveDayBounds("2026-08-13", ZONE);
    const result = expandActivitiesForDay([series()], [movedToTomorrow()], today);
    expect(result).toHaveLength(0);
  });

  it("shows it on the day it was moved to", () => {
    const tomorrow = resolveDayBounds("2026-08-14", ZONE);
    const result = expandActivitiesForDay([series()], [movedToTomorrow()], tomorrow);
    expect(result).toHaveLength(1);
    expect(result[0]!.title).toBe("Deep work");
    expect(result[0]!.dtstartLocal.toISOString()).toBe(at9am("2026-08-14").toISOString());
    // The occurrence identity is preserved so a later edit still targets it.
    expect(result[0]!.occurrenceKey.toISOString()).toBe(at9am("2026-08-13").toISOString());
  });

  it("does not duplicate when the move stays inside the same day", () => {
    const today = resolveDayBounds("2026-08-13", ZONE);
    const sameDay = {
      ...movedToTomorrow(),
      startAt: new Date(at9am("2026-08-13").getTime() + 2 * 60 * 60 * 1000),
    };
    const result = expandActivitiesForDay([series()], [sameDay], today);
    expect(result).toHaveLength(1);
    expect(result[0]!.dtstartLocal.getTime()).toBe(sameDay.startAt.getTime());
  });

  it("still hides a cancelled occurrence on the destination day", () => {
    const tomorrow = resolveDayBounds("2026-08-14", ZONE);
    const cancelled = { ...movedToTomorrow(), status: "cancelled" };
    expect(expandActivitiesForDay([series()], [cancelled], tomorrow)).toHaveLength(0);
  });

  it("does not resurrect an occurrence whose series was deleted", () => {
    const tomorrow = resolveDayBounds("2026-08-14", ZONE);
    const deleted = series({ deletedAt: new Date() });
    expect(expandActivitiesForDay([deleted], [movedToTomorrow()], tomorrow)).toHaveLength(0);
  });

  it("moves a recurring instance without disturbing its siblings", () => {
    const daily = series({ rrule: "FREQ=DAILY" });
    const today = resolveDayBounds("2026-08-13", ZONE);
    const tomorrow = resolveDayBounds("2026-08-14", ZONE);

    // Today's instance is pushed to tomorrow; tomorrow's own instance remains.
    const onToday = expandActivitiesForDay([daily], [movedToTomorrow()], today);
    expect(onToday).toHaveLength(0);

    const onTomorrow = expandActivitiesForDay([daily], [movedToTomorrow()], tomorrow);
    expect(onTomorrow).toHaveLength(2);
    expect(
      onTomorrow.map((a) => a.occurrenceKey.toISOString()).sort(),
    ).toEqual([at9am("2026-08-13").toISOString(), at9am("2026-08-14").toISOString()]);
  });
});
