/**
 * Pure unit tests for clientToday — "today" as YYYY-MM-DD for client UI,
 * zone-aware with a graceful fallback to the browser's local calendar date.
 */
import { describe, expect, it } from "vitest";
import { clientToday } from "./client-date";

describe("clientToday", () => {
  it("returns a YYYY-MM-DD string for a valid IANA zone", () => {
    const result = clientToday("America/New_York");
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("returns a YYYY-MM-DD string when no zone is given (browser local)", () => {
    const result = clientToday();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("agrees with a direct Intl.DateTimeFormat computation for a fixed zone", () => {
    const zone = "Asia/Tokyo";
    const expected = new Intl.DateTimeFormat("en-CA", {
      timeZone: zone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    expect(clientToday(zone)).toBe(expected);
  });

  it("falls back to the local calendar date for an invalid zone rather than throwing", () => {
    expect(() => clientToday("Not/AZone")).not.toThrow();
    const result = clientToday("Not/AZone");
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // Should match the local-calendar fallback path's output exactly.
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    expect(result).toBe(`${y}-${m}-${d}`);
  });

  it("UTC and a far-behind zone can disagree on calendar date near midnight boundaries (sanity, not flaky since both are deterministic per instant)", () => {
    // Not asserting a specific relationship (that would be a live-clock race);
    // just confirming both zones independently produce well-formed output for
    // the same instant.
    expect(clientToday("UTC")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(clientToday("Pacific/Kiritimati")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
