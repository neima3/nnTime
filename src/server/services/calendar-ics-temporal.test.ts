/**
 * ICS temporal parsing — ADR-001 (instants, zones, dates).
 *
 * Fixtures are copied from the shapes Google Calendar / Apple Calendar
 * actually emit: TZID-qualified local wall time (no trailing Z), floating
 * local time, UTC `…Z`, and `VALUE=DATE` all-day events.
 */
import { describe, expect, it } from "vitest";
import { parseIcs } from "./calendar";
import { instantToDateStr } from "../temporal/zone";

const NY = "America/New_York";

/** Google Calendar export: TZID-qualified local wall clock, no trailing Z. */
const GOOGLE_TIMED = `BEGIN:VCALENDAR
PRODID:-//Google Inc//Google Calendar 70.9054//EN
VERSION:2.0
CALSCALE:GREGORIAN
METHOD:PUBLISH
BEGIN:VTIMEZONE
TZID:America/New_York
END:VTIMEZONE
BEGIN:VEVENT
DTSTART;TZID=America/New_York:20260717T100000
DTEND;TZID=America/New_York:20260717T113000
DTSTAMP:20260701T120000Z
UID:google-timed@google.com
SUMMARY:Team sync
END:VEVENT
END:VCALENDAR`;

/** Apple Calendar export: all-day event (VALUE=DATE), exclusive DTEND. */
const APPLE_ALL_DAY = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Apple Inc.//macOS 26.1//EN
CALSCALE:GREGORIAN
BEGIN:VEVENT
UID:apple-allday@icloud.com
DTSTART;VALUE=DATE:20260718
DTEND;VALUE=DATE:20260719
SUMMARY:Mom's birthday
END:VEVENT
END:VCALENDAR`;

/** Floating local time — no TZID, no Z (RFC 5545 §3.3.5 form 1). */
const FLOATING = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:floating@test
SUMMARY:Floating standup
DTSTART:20260717T090000
DTEND:20260717T093000
END:VEVENT
END:VCALENDAR`;

/** UTC instants — the only form the old parser accepted. */
const UTC_TIMED = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:utc@test
SUMMARY:UTC meeting
DTSTART:20260717T140000Z
DTEND:20260717T150000Z
END:VEVENT
END:VCALENDAR`;

/** 2026-03-08 02:30 New York does not exist (spring forward 02:00→03:00). */
const DST_GAP = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:dst-gap@test
SUMMARY:Nonexistent local time
DTSTART;TZID=America/New_York:20260308T023000
DTEND;TZID=America/New_York:20260308T033000
END:VEVENT
END:VCALENDAR`;

/** 2026-11-01 01:30 New York happens twice (fall back 02:00→01:00). */
const DST_FOLD = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:dst-fold@test
SUMMARY:Ambiguous local time
DTSTART;TZID=America/New_York:20261101T013000
END:VEVENT
END:VCALENDAR`;

describe("ICS timed events (ADR-001 instants)", () => {
  it("imports a TZID-qualified local time (the normal Google/Apple form)", () => {
    const [ev] = parseIcs(GOOGLE_TIMED, NY);
    expect(ev!.title).toBe("Team sync");
    expect(ev!.allDay).toBe(false);
    // 10:00 EDT = 14:00 UTC — the event must not be dropped.
    expect(ev!.start?.toISOString()).toBe("2026-07-17T14:00:00.000Z");
    expect(ev!.end?.toISOString()).toBe("2026-07-17T15:30:00.000Z");
  });

  it("resolves a TZID against the event's zone, not the importer's", () => {
    // Importer in Los Angeles; the event still means 10:00 New York.
    const [ev] = parseIcs(GOOGLE_TIMED, "America/Los_Angeles");
    expect(ev!.start?.toISOString()).toBe("2026-07-17T14:00:00.000Z");
  });

  it("resolves a floating local time in the importing user's zone", () => {
    const [ny] = parseIcs(FLOATING, NY);
    expect(ny!.start?.toISOString()).toBe("2026-07-17T13:00:00.000Z");
    const [tokyo] = parseIcs(FLOATING, "Asia/Tokyo");
    expect(tokyo!.start?.toISOString()).toBe("2026-07-17T00:00:00.000Z");
  });

  it("keeps UTC (…Z) values absolute", () => {
    const [ev] = parseIcs(UTC_TIMED, NY);
    expect(ev!.start?.toISOString()).toBe("2026-07-17T14:00:00.000Z");
    expect(ev!.end?.toISOString()).toBe("2026-07-17T15:00:00.000Z");
  });

  it("shifts a spring-forward gap time to the first valid instant", () => {
    const [ev] = parseIcs(DST_GAP, NY);
    // 02:30 EST does not exist → 03:30 EDT = 07:30 UTC.
    expect(ev!.start?.toISOString()).toBe("2026-03-08T07:30:00.000Z");
    expect(instantToDateStr(ev!.start!, NY)).toBe("2026-03-08");
  });

  it("takes the FIRST occurrence of an ambiguous fall-back time", () => {
    const [ev] = parseIcs(DST_FOLD, NY);
    // 01:30 EDT (UTC-4) is the first of the two occurrences.
    expect(ev!.start?.toISOString()).toBe("2026-11-01T05:30:00.000Z");
  });

  it("falls back to the user's zone for a TZID it cannot resolve", () => {
    const outlook = GOOGLE_TIMED.replace(
      /TZID=America\/New_York/g,
      'TZID="Eastern Standard Time"',
    );
    const [ev] = parseIcs(outlook, NY);
    expect(ev!.start?.toISOString()).toBe("2026-07-17T14:00:00.000Z");
  });
});

describe("ICS all-day events (ADR-001 date-only)", () => {
  it("names the calendar day, not a midnight-UTC instant", () => {
    const [ev] = parseIcs(APPLE_ALL_DAY, NY);
    expect(ev!.allDay).toBe(true);
    expect(ev!.startDate).toBe("2026-07-18");
    expect(ev!.endDate).toBe("2026-07-19");
  });

  it("lands on the named day for a user west of UTC", () => {
    const [ev] = parseIcs(APPLE_ALL_DAY, NY);
    // Old behaviour: 2026-07-18T00:00Z → July 17, 8pm in New York.
    expect(instantToDateStr(ev!.start!, NY)).toBe("2026-07-18");
    expect(ev!.start?.toISOString()).toBe("2026-07-18T04:00:00.000Z");
  });

  it("lands on the named day for a user east of UTC", () => {
    const [ev] = parseIcs(APPLE_ALL_DAY, "Asia/Tokyo");
    expect(instantToDateStr(ev!.start!, "Asia/Tokyo")).toBe("2026-07-18");
  });

  it("treats a bare DATE value (no VALUE=DATE param) as all-day", () => {
    const bare = APPLE_ALL_DAY.replace(/;VALUE=DATE/g, "");
    const [ev] = parseIcs(bare, NY);
    expect(ev!.allDay).toBe(true);
    expect(ev!.startDate).toBe("2026-07-18");
  });
});

describe("ICS text handling", () => {
  it("unfolds continuation lines and unescapes text", () => {
    const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:folded@test
SUMMARY:Pharmacy shift\\, evening cover — a title long enough that Google
  folds it onto a second line
DTSTART;TZID=America/New_York:20260717T170000
END:VEVENT
END:VCALENDAR`;
    const [ev] = parseIcs(ics, NY);
    expect(ev!.title).toBe(
      "Pharmacy shift, evening cover — a title long enough that Google folds it onto a second line",
    );
    expect(ev!.start?.toISOString()).toBe("2026-07-17T21:00:00.000Z");
  });
});
