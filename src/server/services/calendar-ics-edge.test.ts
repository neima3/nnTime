/**
 * Additional pure ICS-parser edge cases not covered by calendar.test.ts
 * (which covers the happy path, all-day events, and empty/malformed input).
 * This file focuses on: missing UID/SUMMARY fallbacks, unrecognized date
 * formats, multiple VEVENTs, and fields containing colons.
 */
import { describe, expect, it } from "vitest";
import { parseIcs } from "./calendar";

describe("parseIcs edge cases", () => {
  it("falls back to a random UID when UID is missing", () => {
    const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
SUMMARY:No UID here
DTSTART:20260101T090000Z
END:VEVENT
END:VCALENDAR`;
    const events = parseIcs(ics);
    expect(events).toHaveLength(1);
    expect(events[0]!.uid).toBeTruthy();
    expect(typeof events[0]!.uid).toBe("string");
  });

  it("falls back to 'Untitled' when SUMMARY is missing", () => {
    const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:no-summary@test
DTSTART:20260101T090000Z
END:VEVENT
END:VCALENDAR`;
    const events = parseIcs(ics);
    expect(events[0]!.title).toBe("Untitled");
  });

  it("leaves start/end undefined for an unrecognized date format", () => {
    const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:weird-date@test
SUMMARY:Weird date
DTSTART:2026-01-01
END:VEVENT
END:VCALENDAR`;
    const events = parseIcs(ics);
    expect(events[0]!.start).toBeUndefined();
    // Not all-8-digits, so allDay should be false rather than throwing.
    expect(events[0]!.allDay).toBe(false);
  });

  it("parses a SUMMARY value that itself contains a colon", () => {
    const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:colon@test
SUMMARY:Meeting: Q3 planning
DTSTART:20260101T090000Z
DTEND:20260101T100000Z
END:VEVENT
END:VCALENDAR`;
    const events = parseIcs(ics);
    expect(events[0]!.title).toBe("Meeting: Q3 planning");
  });

  it("parses multiple VEVENTs in encounter order", () => {
    const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:first@test
SUMMARY:First
DTSTART:20260101T090000Z
END:VEVENT
BEGIN:VEVENT
UID:second@test
SUMMARY:Second
DTSTART:20260102T090000Z
END:VEVENT
BEGIN:VEVENT
UID:third@test
SUMMARY:Third
DTSTART:20260103T090000Z
END:VEVENT
END:VCALENDAR`;
    const events = parseIcs(ics);
    expect(events.map((e) => e.title)).toEqual(["First", "Second", "Third"]);
    expect(events.map((e) => e.uid)).toEqual(["first@test", "second@test", "third@test"]);
  });

  it("handles a VEVENT with a DTSTART;TZID= parameter (still extracts the value)", () => {
    const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:tzid@test
SUMMARY:With TZID param
DTSTART;TZID=America/New_York:20260101T090000Z
END:VEVENT
END:VCALENDAR`;
    const events = parseIcs(ics);
    // The parser's key regex matches "DTSTART" prefix with any params before ':'.
    expect(events[0]!.start?.toISOString()).toBe("2026-01-01T09:00:00.000Z");
  });

  it("event with only DTSTART and no DTEND leaves end undefined", () => {
    const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:no-end@test
SUMMARY:No end
DTSTART:20260101T090000Z
END:VEVENT
END:VCALENDAR`;
    const events = parseIcs(ics);
    expect(events[0]!.start).toBeDefined();
    expect(events[0]!.end).toBeUndefined();
  });

  it("returns an empty array when there is no BEGIN:VEVENT block at all", () => {
    const ics = `BEGIN:VCALENDAR\nVERSION:2.0\nEND:VCALENDAR`;
    expect(parseIcs(ics)).toEqual([]);
  });
});
