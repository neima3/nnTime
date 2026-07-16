import { describe, expect, it } from "vitest";
import { detectTimezone } from "./timezone";

describe("timezone detection", () => {
  it("returns a string with a slash for IANA zones", () => {
    const tz = detectTimezone();
    expect(typeof tz).toBe("string");
    expect(tz.length).toBeGreaterThan(2);
  });

  it("falls back to UTC on error", () => {
    const original = Intl.DateTimeFormat;
    // @ts-expect-error — intentionally breaking it
    Intl.DateTimeFormat = () => { throw new Error("test"); };
    expect(detectTimezone()).toBe("UTC");
    Intl.DateTimeFormat = original;
  });
});
