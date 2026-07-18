/**
 * Calendar service tests — ICS parsing + SSRF public-IP classification.
 */
import { describe, expect, it } from "vitest";
import { isPublicIp, parseIcs } from "./calendar";

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
    expect(events[0]!.title).toBe("Test Meeting");
    expect(events[0]!.start?.toISOString()).toBe("2026-07-17T10:00:00.000Z");
    expect(events[0]!.end?.toISOString()).toBe("2026-07-17T11:00:00.000Z");
    expect(events[0]!.allDay).toBe(false);
  });

  it("parses all-day events", () => {
    const events = parseIcs(SAMPLE_ICS);
    expect(events[1]!.title).toBe("All Day Event");
    expect(events[1]!.allDay).toBe(true);
  });

  it("handles empty/malformed ICS", () => {
    expect(parseIcs("")).toEqual([]);
    expect(parseIcs("not ics at all")).toEqual([]);
    expect(parseIcs("BEGIN:VCALENDAR\nEND:VCALENDAR")).toEqual([]);
  });
});

describe("isPublicIp (SEC-04)", () => {
  describe("rejects private / non-public IPv4", () => {
    it("blocks loopback 127.0.0.0/8", () => {
      expect(isPublicIp("127.0.0.1")).toBe(false);
      expect(isPublicIp("127.0.0.0")).toBe(false);
      expect(isPublicIp("127.255.255.255")).toBe(false);
    });

    it("blocks 0.0.0.0", () => {
      expect(isPublicIp("0.0.0.0")).toBe(false);
    });

    it("blocks RFC1918 10.0.0.0/8", () => {
      expect(isPublicIp("10.0.0.1")).toBe(false);
      expect(isPublicIp("10.255.255.255")).toBe(false);
    });

    it("blocks RFC1918 172.16.0.0/12", () => {
      expect(isPublicIp("172.16.0.1")).toBe(false);
      expect(isPublicIp("172.31.255.255")).toBe(false);
      // Adjacent public-ish edges of the /12
      expect(isPublicIp("172.15.255.255")).toBe(true);
      expect(isPublicIp("172.32.0.1")).toBe(true);
    });

    it("blocks RFC1918 192.168.0.0/16", () => {
      expect(isPublicIp("192.168.0.1")).toBe(false);
      expect(isPublicIp("192.168.255.255")).toBe(false);
    });

    it("blocks link-local + metadata 169.254.0.0/16", () => {
      expect(isPublicIp("169.254.0.1")).toBe(false);
      expect(isPublicIp("169.254.169.254")).toBe(false);
    });

    it("blocks CGNAT 100.64.0.0/10", () => {
      expect(isPublicIp("100.64.0.1")).toBe(false);
      expect(isPublicIp("100.127.255.255")).toBe(false);
      expect(isPublicIp("100.63.255.255")).toBe(true);
      expect(isPublicIp("100.128.0.1")).toBe(true);
    });
  });

  describe("rejects private / non-public IPv6", () => {
    it("blocks ::1 loopback", () => {
      expect(isPublicIp("::1")).toBe(false);
      expect(isPublicIp("0:0:0:0:0:0:0:1")).toBe(false);
    });

    it("blocks unique local fc00::/7", () => {
      expect(isPublicIp("fc00::1")).toBe(false);
      expect(isPublicIp("fd12:3456:789a::1")).toBe(false);
    });

    it("blocks link-local fe80::/10", () => {
      expect(isPublicIp("fe80::1")).toBe(false);
      expect(isPublicIp("febf:ffff:ffff:ffff:ffff:ffff:ffff:ffff")).toBe(false);
    });

    it("blocks IPv4-mapped private addresses", () => {
      expect(isPublicIp("::ffff:127.0.0.1")).toBe(false);
      expect(isPublicIp("::ffff:10.0.0.1")).toBe(false);
      expect(isPublicIp("::ffff:192.168.1.1")).toBe(false);
      expect(isPublicIp("::ffff:169.254.169.254")).toBe(false);
      expect(isPublicIp("::ffff:100.64.0.1")).toBe(false);
      expect(isPublicIp("::ffff:172.16.0.1")).toBe(false);
      // Hex form of ::ffff:10.0.0.1
      expect(isPublicIp("::ffff:a00:1")).toBe(false);
    });
  });

  describe("allows public addresses", () => {
    it("allows public IPv4", () => {
      expect(isPublicIp("8.8.8.8")).toBe(true);
      expect(isPublicIp("1.1.1.1")).toBe(true);
      expect(isPublicIp("93.184.216.34")).toBe(true);
    });

    it("allows public IPv6", () => {
      expect(isPublicIp("2001:4860:4860::8888")).toBe(true);
      expect(isPublicIp("2606:4700:4700::1111")).toBe(true);
    });

    it("allows IPv4-mapped public addresses", () => {
      expect(isPublicIp("::ffff:8.8.8.8")).toBe(true);
      expect(isPublicIp("::ffff:808:808")).toBe(true);
    });
  });

  describe("rejects garbage", () => {
    it("returns false for non-IP strings", () => {
      expect(isPublicIp("")).toBe(false);
      expect(isPublicIp("not-an-ip")).toBe(false);
      expect(isPublicIp("999.999.999.999")).toBe(false);
      expect(isPublicIp("localhost")).toBe(false);
    });
  });
});
