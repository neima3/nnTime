/**
 * Redaction unit tests — 6.2 `client_error_reports` (ADR-005 SEC-03/SEC-05).
 *
 * Realistic strings a browser could plausibly interpolate into
 * `message`/`stack`/`path` when a fetch or auth call fails. Every case
 * asserts BOTH that the sensitive span is gone AND that nothing else in the
 * string was mangled — an over-eager redactor that nukes the whole message
 * would pass a naive "does not contain the secret" check while destroying
 * the report's diagnostic value.
 */
import { describe, expect, it } from "vitest";
import { redactClientErrorReport, redactErrorText } from "./redact";

describe("redactErrorText", () => {
  it("passes null/undefined through unchanged", () => {
    expect(redactErrorText(null)).toBeNull();
    expect(redactErrorText(undefined)).toBeUndefined();
  });

  it("leaves an ordinary error message untouched", () => {
    const msg = "Cannot read properties of undefined (reading 'map')";
    expect(redactErrorText(msg)).toBe(msg);
  });

  it("leaves an ordinary path untouched", () => {
    expect(redactErrorText("/app/today")).toBe("/app/today");
  });

  it("redacts an Authorization header with a Bearer scheme", () => {
    const input =
      "GET /api/v1/settings 401 — Authorization: Bearer sk_live_9f8a7b6c5d4e3f2a1b failed";
    const out = redactErrorText(input);
    expect(out).not.toContain("sk_live_9f8a7b6c5d4e3f2a1b");
    expect(out).toContain("authorization: [redacted]");
    expect(out).toContain("GET /api/v1/settings 401");
  });

  it("redacts a raw Bearer token with no Authorization: prefix", () => {
    const jwt =
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U";
    const input = `fetch failed: Bearer ${jwt}`;
    const out = redactErrorText(input);
    expect(out).not.toContain(jwt);
    expect(out).toBe("fetch failed: Bearer [redacted]");
  });

  it("redacts a Cookie header value", () => {
    const input = "Cookie: kairo_session=abcdef0123456789; theme=dark";
    const out = redactErrorText(input);
    expect(out).not.toContain("abcdef0123456789");
    expect(out).toBe("Cookie: [redacted]");
  });

  it("redacts a Set-Cookie response header value", () => {
    const input =
      "response headers: Set-Cookie: kairo_session=zzz999; Path=/; HttpOnly; Secure";
    const out = redactErrorText(input);
    expect(out).not.toContain("zzz999");
    expect(out).toContain("Set-Cookie: [redacted]");
    expect(out).toContain("response headers:");
  });

  it("redacts a token= query-string secret but keeps the rest of the URL", () => {
    const input =
      "Failed to load resource: /api/auth/magic-link/verify?token=9f86d081884c7d659a2feaa0c55ad015de7d81a&callback=/app/today";
    const out = redactErrorText(input);
    expect(out).not.toContain("9f86d081884c7d659a2feaa0c55ad015de7d81a");
    expect(out).toBe(
      "Failed to load resource: /api/auth/magic-link/verify?token=[redacted]&callback=/app/today",
    );
  });

  it("redacts a key= query-string secret (e.g. a map/analytics API key)", () => {
    const input = "GET https://maps.example.com/tiles?key=AIzaSyD4RgXaB1234567890&z=12";
    const out = redactErrorText(input);
    expect(out).not.toContain("AIzaSyD4RgXaB1234567890");
    expect(out).toContain("key=[redacted]");
    expect(out).toContain("&z=12");
  });

  it("redacts an apiKey= and access_token= query secret", () => {
    const input = "?apiKey=abc123&access_token=def456&ok=1";
    const out = redactErrorText(input);
    expect(out).toBe("?apiKey=[redacted]&access_token=[redacted]&ok=1");
  });

  it("redacts a webcal:// calendar feed URL", () => {
    const input =
      "SSRF guard rejected: webcal://caldav.icloud.com/private-XYZ123abc/events/";
    const out = redactErrorText(input);
    expect(out).not.toContain("private-XYZ123abc");
    expect(out).toBe("SSRF guard rejected: [redacted]");
  });

  it("redacts an https .ics feed URL", () => {
    const input =
      "Unable to import calendar: https://calendar.example.com/feed/u-8f3c21/basic.ics";
    const out = redactErrorText(input);
    expect(out).not.toContain("u-8f3c21");
    expect(out).toBe("Unable to import calendar: [redacted]");
  });

  it("redacts an .ics feed URL that itself carries a query-string secret", () => {
    const input =
      "GET https://calendar.example.com/private-abc123/basic.ics?token=shh-dont-tell failed with 403";
    const out = redactErrorText(input);
    expect(out).not.toContain("private-abc123");
    expect(out).not.toContain("shh-dont-tell");
    expect(out).toBe("GET [redacted] failed with 403");
  });

  it("redacts multiple distinct secrets in one stack trace", () => {
    const input = [
      "Error: Request failed",
      "  at fetchSettings (/app/lib/api.ts:42:11)",
      "  Authorization: Bearer abc.def.ghi",
      "  Cookie: kairo_session=deadbeef",
      "  url: /api/v1/calendar/ics?url=webcal://x.example.com/feed.ics?token=leaked",
    ].join("\n");
    const out = redactErrorText(input);
    expect(out).not.toContain("abc.def.ghi");
    expect(out).not.toContain("deadbeef");
    expect(out).not.toContain("leaked");
    expect(out).not.toContain("x.example.com");
    // Structural content survives — this is still a useful stack trace.
    expect(out).toContain("Error: Request failed");
    expect(out).toContain("at fetchSettings (/app/lib/api.ts:42:11)");
  });

  it("is idempotent — redacting an already-redacted string is a no-op", () => {
    const once = redactErrorText("Authorization: Bearer supersecrettoken");
    const twice = redactErrorText(once);
    expect(twice).toBe(once);
  });
});

describe("redactClientErrorReport", () => {
  it("redacts message, stack, and path together and leaves name untouched", () => {
    const report = {
      name: "TypeError",
      message: "fetch failed: Bearer abc123secret",
      stack: "Cookie: kairo_session=deadbeef\n  at foo (/app/x.ts:1:1)",
      path: "/app/today?token=leak-me",
    };
    const out = redactClientErrorReport(report);
    expect(out.name).toBe("TypeError");
    expect(out.message).not.toContain("abc123secret");
    expect(out.stack).not.toContain("deadbeef");
    expect(out.path).not.toContain("leak-me");
    expect(out.path).toBe("/app/today?token=[redacted]");
  });

  it("handles a report with no stack/path", () => {
    const out = redactClientErrorReport({
      name: "Error",
      message: "boom",
      stack: null,
      path: null,
    });
    expect(out).toEqual({ name: "Error", message: "boom", stack: null, path: null });
  });
});
