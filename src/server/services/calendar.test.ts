/**
 * Pure ICS parser + SSRF guard unit tests (no network / no DB).
 */
import { describe, expect, it } from "vitest";
import { parseIcs, fetchIcs } from "./calendar";

const SAMPLE = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:evt-1@example.com
SUMMARY:Standup
DTSTART:20260715T140000Z
DTEND:20260715T143000Z
END:VEVENT
BEGIN:VEVENT
UID:evt-2@example.com
SUMMARY:All day off
DTSTART:20260716
DTEND:20260717
END:VEVENT
END:VCALENDAR`;

describe("parseIcs", () => {
  it("extracts VEVENT titles and uids", () => {
    const events = parseIcs(SAMPLE);
    expect(events).toHaveLength(2);
    expect(events[0].title).toBe("Standup");
    expect(events[0].uid).toBe("evt-1@example.com");
    expect(events[0].start).toBeInstanceOf(Date);
    expect(events[1].allDay).toBe(true);
  });

  it("returns empty for no events", () => {
    expect(parseIcs("BEGIN:VCALENDAR\nEND:VCALENDAR")).toEqual([]);
  });
});

describe("fetchIcs SSRF guards", () => {
  it("rejects non-http protocols", async () => {
    await expect(fetchIcs("file:///etc/passwd")).rejects.toThrow(/http/i);
  });

  it("rejects ftp", async () => {
    await expect(fetchIcs("ftp://example.com/cal.ics")).rejects.toThrow(/http/i);
  });
});
