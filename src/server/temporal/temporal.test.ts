/**
 * ADR-001 deterministic temporal test matrix.
 *
 * Required scenarios (binding, per ADR-001):
 *  - DST gap (spring-forward): nonexistent local time shifts forward.
 *  - DST fold (fall-back): ambiguous local time takes the FIRST occurrence.
 *  - Leap day (Feb 29) recurrence.
 *  - Month-end recurrence (Jan 31 monthly → clamps to Feb 28/29).
 *  - Series split: occurrence_key survives (this-and-future semantics).
 *  - Planning-zone change: manual activities keep wall time; expansion reflows.
 *  - Custom N-day interval (deliberate Tiimo-beating feature).
 *  - UNTIL/COUNT termination.
 */
import { describe, expect, it } from "vitest";
import {
  resolveDayBounds,
  wallClockToInstant,
  instantToDateStr,
  isValidZone,
} from "./zone";
import { parseRrule, expandSeries } from "./recurrence";

describe("timezone validation", () => {
  it("accepts valid IANA zones", () => {
    expect(isValidZone("America/New_York")).toBe(true);
    expect(isValidZone("Europe/London")).toBe(true);
    expect(isValidZone("Asia/Kolkata")).toBe(true);
    expect(isValidZone("UTC")).toBe(true);
  });

  it("rejects garbage", () => {
    expect(isValidZone(" EST ")).toBe(false);
    expect(isValidZone("New_York")).toBe(false);
    expect(isValidZone("America/Not A Zone")).toBe(false);
  });
});

describe("DST gap (spring-forward) — ADR-001", () => {
  // America/New_York spring-forward 2024: Mar 10, 02:00 → 03:00 (EST→EDT).
  // 02:30 does not exist; rule says shift forward to first valid instant.
  it("shifts a nonexistent time forward to the first valid instant", () => {
    const gap = wallClockToInstant(2024, 2, 10, 2, 30, 0, "America/New_York");
    // 02:30 EST doesn't exist; the gap is 02:00–03:00. First valid instant
    // after the gap for a 02:30 wall time is 03:30 EDT = 07:30 UTC.
    expect(gap.toISOString()).toBe("2024-03-10T07:30:00.000Z");
  });

  it("leaves pre-gap times on the standard offset", () => {
    const pre = wallClockToInstant(2024, 2, 10, 1, 30, 0, "America/New_York");
    // 01:30 EST = 06:30 UTC
    expect(pre.toISOString()).toBe("2024-03-10T06:30:00.000Z");
  });

  it("leaves post-gap times on the DST offset", () => {
    const post = wallClockToInstant(2024, 2, 10, 3, 30, 0, "America/New_York");
    // 03:30 EDT = 07:30 UTC
    expect(post.toISOString()).toBe("2024-03-10T07:30:00.000Z");
  });
});

describe("DST fold (fall-back) — ADR-001", () => {
  // America/New_York fall-back 2024: Nov 3, 02:00 → 01:00 (EDT→EST).
  // 01:30 occurs twice. Rule: take the FIRST (earlier, DST) occurrence.
  it("takes the first (DST) occurrence by default", () => {
    const first = wallClockToInstant(2024, 10, 3, 1, 30, 0, "America/New_York", "first");
    // 01:30 EDT = 05:30 UTC
    expect(first.toISOString()).toBe("2024-11-03T05:30:00.000Z");
  });

  it("can take the second (standard) occurrence when requested", () => {
    const second = wallClockToInstant(2024, 10, 3, 1, 30, 0, "America/New_York", "second");
    // 01:30 EST = 06:30 UTC
    expect(second.toISOString()).toBe("2024-11-03T06:30:00.000Z");
  });
});

describe("day bounds resolution — ADR-001", () => {
  it("returns [start, end) midnight-to-midnight in the zone", () => {
    const b = resolveDayBounds("2024-07-13", "America/New_York");
    // Midnight NY = 04:00 UTC; next midnight = 04:00 UTC next day
    expect(b.start.toISOString()).toBe("2024-07-13T04:00:00.000Z");
    expect(b.end.toISOString()).toBe("2024-07-14T04:00:00.000Z");
    expect(b.zone).toBe("America/New_York");
  });

  it("a spring-forward day is a 23-hour UTC span", () => {
    const b = resolveDayBounds("2024-03-10", "America/New_York");
    const spanH = (b.end.getTime() - b.start.getTime()) / 3_600_000;
    expect(spanH).toBe(23);
  });

  it("a fall-back day is a 25-hour UTC span", () => {
    const b = resolveDayBounds("2024-11-03", "America/New_York");
    const spanH = (b.end.getTime() - b.start.getTime()) / 3_600_000;
    expect(spanH).toBe(25);
  });
});

describe("instant-to-date bucketing", () => {
  it("assigns an instant to the calendar date a user in the zone sees", () => {
    // 2024-07-13T10:00 UTC = 06:00 NY → same date
    expect(instantToDateStr(new Date("2024-07-13T10:00:00Z"), "America/New_York")).toBe(
      "2024-07-13",
    );
    // 2024-07-13T03:00 UTC = 2024-07-12 23:00 NY → previous date
    expect(instantToDateStr(new Date("2024-07-13T03:00:00Z"), "America/New_York")).toBe(
      "2024-07-12",
    );
  });
});

describe("RRULE parsing", () => {
  it("parses a daily recurrence with interval", () => {
    const r = parseRrule("FREQ=DAILY;INTERVAL=3");
    expect(r.freq).toBe("DAILY");
    expect(r.interval).toBe(3);
  });

  it("parses COUNT and UNTIL", () => {
    const r = parseRrule("FREQ=WEEKLY;COUNT=10");
    expect(r.count).toBe(10);
    const u = parseRrule("FREQ=DAILY;UNTIL=20241231T235959Z");
    expect(u.until?.toISOString()).toBe("2024-12-31T23:59:59.000Z");
  });

  it("rejects unsupported FREQ", () => {
    expect(() => parseRrule("FREQ=HOURLY")).toThrow();
  });

  it("rejects BYDAY on non-WEEKLY", () => {
    expect(() => parseRrule("FREQ=DAILY;BYDAY=MO")).toThrow();
  });
});

describe("recurrence expansion — deterministic matrix (ADR-001)", () => {
  const dt = {
    year: 2024,
    month: 0, // January
    day: 1,
    hour: 9,
    minute: 0,
    second: 0,
  };

  it("DAILY expands each day", () => {
    const occ = expandSeries({
      rrule: "FREQ=DAILY;COUNT=5",
      tz: "America/New_York",
      dtstart: dt,
      from: new Date("2024-01-01T00:00:00Z"),
      to: new Date("2024-01-31T00:00:00Z"),
      durationMin: 60,
    });
    expect(occ).toHaveLength(5);
    // 09:00 NY Jan 1 = 14:00 UTC
    expect(occ[0].startAt.toISOString()).toBe("2024-01-01T14:00:00.000Z");
    expect(occ[1].startAt.toISOString()).toBe("2024-01-02T14:00:00.000Z");
  });

  it("DAILY with custom N-day interval (Tiimo-beating)", () => {
    const occ = expandSeries({
      rrule: "FREQ=DAILY;INTERVAL=3;COUNT=4",
      tz: "UTC",
      dtstart: { year: 2024, month: 0, day: 1, hour: 9, minute: 0, second: 0 },
      from: new Date("2024-01-01T00:00:00Z"),
      to: new Date("2024-02-01T00:00:00Z"),
      durationMin: 30,
    });
    // Jan 1, 4, 7, 10
    expect(occ.map((o) => o.startAt.toISOString().slice(0, 10))).toEqual([
      "2024-01-01",
      "2024-01-04",
      "2024-01-07",
      "2024-01-10",
    ]);
  });

  it("WEEKLY with BYDAY expands the right weekdays", () => {
    const occ = expandSeries({
      rrule: "FREQ=WEEKLY;BYDAY=MO,WE,FR;COUNT=6",
      tz: "UTC",
      // dtstart is a Monday (2024-01-01 is a Monday)
      dtstart: { year: 2024, month: 0, day: 1, hour: 10, minute: 0, second: 0 },
      from: new Date("2024-01-01T00:00:00Z"),
      to: new Date("2024-03-01T00:00:00Z"),
      durationMin: 30,
    });
    // Mon Jan1, Wed Jan3, Fri Jan5, Mon Jan8, Wed Jan10, Fri Jan12
    expect(occ.map((o) => o.startAt.toISOString().slice(0, 10))).toEqual([
      "2024-01-01",
      "2024-01-03",
      "2024-01-05",
      "2024-01-08",
      "2024-01-10",
      "2024-01-12",
    ]);
  });

  it("leap day: Feb 29 in a leap year", () => {
    const occ = expandSeries({
      rrule: "FREQ=DAILY;COUNT=1",
      tz: "UTC",
      dtstart: { year: 2024, month: 1, day: 29, hour: 12, minute: 0, second: 0 },
      from: new Date("2024-02-01T00:00:00Z"),
      to: new Date("2024-03-15T00:00:00Z"),
      durationMin: 30,
    });
    expect(occ[0].startAt.toISOString()).toBe("2024-02-29T12:00:00.000Z");
  });

  it("month-end recurrence: Jan 31 monthly clamps Feb to 28/29", () => {
    // Jan 31 → Feb 28 (2024 is leap, so Feb 29), Mar 31, Apr 30
    const occ = expandSeries({
      rrule: "FREQ=MONTHLY;COUNT=4",
      tz: "UTC",
      dtstart: { year: 2024, month: 0, day: 31, hour: 9, minute: 0, second: 0 },
      from: new Date("2024-01-01T00:00:00Z"),
      to: new Date("2024-05-15T00:00:00Z"),
      durationMin: 30,
    });
    expect(occ.map((o) => o.startAt.toISOString().slice(0, 10))).toEqual([
      "2024-01-31",
      "2024-02-29", // leap year
      "2024-03-31",
      "2024-04-30", // April has 30 days, clamp
    ]);
  });

  it("DST: a daily recurrence crossing spring-forward keeps 09:00 wall time", () => {
    // 09:00 NY every day across Mar 10 2024 spring-forward. Wall time stays
    // 09:00; the UTC offset changes from -5 to -4.
    const occ = expandSeries({
      rrule: "FREQ=DAILY;COUNT=3",
      tz: "America/New_York",
      dtstart: { year: 2024, month: 2, day: 9, hour: 9, minute: 0, second: 0 },
      from: new Date("2024-03-01T00:00:00Z"),
      to: new Date("2024-03-15T00:00:00Z"),
      durationMin: 30,
    });
    // Mar 9 09:00 EST = 14:00 UTC
    expect(occ[0].startAt.toISOString()).toBe("2024-03-09T14:00:00.000Z");
    // Mar 10 09:00 EDT = 13:00 UTC (offset shifted)
    expect(occ[1].startAt.toISOString()).toBe("2024-03-10T13:00:00.000Z");
    // Mar 11 09:00 EDT = 13:00 UTC
    expect(occ[2].startAt.toISOString()).toBe("2024-03-11T13:00:00.000Z");
  });

  it("UNTIL terminates expansion", () => {
    const occ = expandSeries({
      rrule: "FREQ=DAILY;UNTIL=20240105T235959Z",
      tz: "UTC",
      dtstart: { year: 2024, month: 0, day: 1, hour: 12, minute: 0, second: 0 },
      from: new Date("2024-01-01T00:00:00Z"),
      to: new Date("2024-03-01T00:00:00Z"),
      durationMin: 30,
    });
    // Jan 1..5 inclusive
    expect(occ.map((o) => o.startAt.toISOString().slice(0, 10))).toEqual([
      "2024-01-01",
      "2024-01-02",
      "2024-01-03",
      "2024-01-04",
      "2024-01-05",
    ]);
  });

  it("EXDATE skips an occurrence", () => {
    const skip = new Date("2024-01-02T12:00:00.000Z");
    const occ = expandSeries({
      rrule: "FREQ=DAILY;COUNT=3",
      tz: "UTC",
      dtstart: { year: 2024, month: 0, day: 1, hour: 12, minute: 0, second: 0 },
      from: new Date("2024-01-01T00:00:00Z"),
      to: new Date("2024-03-01T00:00:00Z"),
      durationMin: 30,
      exdates: [skip],
    });
    expect(occ.map((o) => o.startAt.toISOString().slice(0, 10))).toEqual([
      "2024-01-01",
      "2024-01-03",
    ]);
  });

  it("planning-zone change keeps wall time (manual activity reflows)", () => {
    // A 09:00 activity defined in UTC, re-expanded in America/New_York, keeps
    // 09:00 wall time in the new zone (ADR-001: manual = local wall time).
    const inUtc = expandSeries({
      rrule: "FREQ=DAILY;COUNT=1",
      tz: "UTC",
      dtstart: { year: 2024, month: 0, day: 1, hour: 9, minute: 0, second: 0 },
      from: new Date("2024-01-01T00:00:00Z"),
      to: new Date("2024-02-01T00:00:00Z"),
      durationMin: 30,
    });
    const inNy = expandSeries({
      rrule: "FREQ=DAILY;COUNT=1",
      tz: "America/New_York",
      dtstart: { year: 2024, month: 0, day: 1, hour: 9, minute: 0, second: 0 },
      from: new Date("2024-01-01T00:00:00Z"),
      to: new Date("2024-02-01T00:00:00Z"),
      durationMin: 30,
    });
    // UTC 09:00 = 09:00Z; NY 09:00 = 14:00Z. Same wall time, different instant.
    expect(inUtc[0].startAt.toISOString()).toBe("2024-01-01T09:00:00.000Z");
    expect(inNy[0].startAt.toISOString()).toBe("2024-01-01T14:00:00.000Z");
  });
});

describe("series split — occurrence_key stability (ADR-001)", () => {
  it("occurrence_key is deterministic and stable across a series split", () => {
    // "This and future" split: the old series is truncated, a new one starts at
    // the chosen occurrence. occurrence_key MUST survive (ADR-001). Here we
    // verify the key for the Nth occurrence is identical whether computed from
    // the old or the new (truncated+restarted) series start — because the key
    // is the wall-clock instant, not a per-series sequence number.
    const dtstart = {
      year: 2024,
      month: 0,
      day: 1,
      hour: 9,
      minute: 0,
      second: 0,
    };
    const occ = expandSeries({
      rrule: "FREQ=DAILY;COUNT=5",
      tz: "UTC",
      dtstart,
      from: new Date("2024-01-01T00:00:00Z"),
      to: new Date("2024-03-01T00:00:00Z"),
      durationMin: 30,
    });
    // The 3rd occurrence's key (Jan 3 09:00 UTC) is the same wall-clock instant
    // regardless of which series row points at it.
    const third = occ[2];
    expect(third.occurrenceKey.getTime()).toBe(third.startAt.getTime());
    expect(third.occurrenceKey.toISOString()).toBe("2024-01-03T09:00:00.000Z");
    // A new series "starting here" carries this exact key.
    const splitSeries = expandSeries({
      rrule: "FREQ=DAILY;COUNT=2",
      tz: "UTC",
      dtstart: { year: 2024, month: 0, day: 3, hour: 9, minute: 0, second: 0 },
      from: new Date("2024-01-01T00:00:00Z"),
      to: new Date("2024-03-01T00:00:00Z"),
      durationMin: 30,
    });
    expect(splitSeries[0].occurrenceKey.toISOString()).toBe(
      third.occurrenceKey.toISOString(),
    );
  });
});
