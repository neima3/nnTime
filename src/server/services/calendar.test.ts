/**
 * Calendar service tests — ICS parsing + token encryption.
 */
import { describe, expect, it } from "vitest";
import { parseIcs } from "./calendar";

const SAMPLE_ICS = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Test//EN
BEGIN:VEVENT
UID:test-1@test
SUMMARY:Test Meeting
DTSTART:20260717T100000Z
DTEND:20260717T110000Z
END:VEVENT
BEGIN:VEVENT
UID:test-2@test
SUMMARY:All Day Event
DTSTART:20260718
DTEND:20260719
END:VEVENT
END:VCALENDAR`;

describe("ICS parser", () => {
  it("parses timed events", () => {
    const events = parseIcs(SAMPLE_ICS);
    expect(events).toHaveLength(2);
    expect(events[0].title).toBe("Test Meeting");
    expect(events[0].start?.toISOString()).toBe("2026-07-17T10:00:00.000Z");
    expect(events[0].end?.toISOString()).toBe("2026-07-17T11:00:00.000Z");
    expect(events[0].allDay).toBe(false);
  });

  it("parses all-day events", () => {
    const events = parseIcs(SAMPLE_ICS);
    expect(events[1].title).toBe("All Day Event");
    expect(events[1].allDay).toBe(true);
  });

  it("handles empty/malformed ICS", () => {
    expect(parseIcs("")).toEqual([]);
    expect(parseIcs("not ics at all")).toEqual([]);
    expect(parseIcs("BEGIN:VCALENDAR\nEND:VCALENDAR")).toEqual([]);
  });
});
