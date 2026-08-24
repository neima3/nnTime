/**
 * POST /api/v1/client-errors — 6.2 route contract.
 *
 * Covers: auth gate, rate limiting, redaction-before-insert, trim+truncate
 * (never reject) at the field caps, 204 with no echoed body, and that a
 * client-supplied `userId`/`ownerId` never reaches the DAL call.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireSession: vi.fn(),
  createClientErrorReport: vi.fn(),
  checkRateLimit: vi.fn(),
  rateLimitedResponse: vi.fn(),
}));

vi.mock("@/server/auth-session", () => ({ requireSession: mocks.requireSession }));
vi.mock("@/server/dal", () => ({
  createClientErrorReport: mocks.createClientErrorReport,
}));
vi.mock("@/server/ratelimit", () => ({
  checkRateLimit: mocks.checkRateLimit,
  rateLimitedResponse: mocks.rateLimitedResponse,
}));

import { POST } from "./route";

function request(body: unknown) {
  return new Request("https://time.neima.me/api/v1/client-errors", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/v1/client-errors", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireSession.mockResolvedValue({ userId: "user-1" });
    mocks.createClientErrorReport.mockResolvedValue({ id: "report-1" });
    mocks.checkRateLimit.mockResolvedValue({ allowed: true, remaining: 9, retryAfterSec: 0 });
    mocks.rateLimitedResponse.mockReturnValue(
      new Response(null, { status: 429 }),
    );
  });

  it("records a report scoped to the session userId and responds 204 with no body", async () => {
    const response = await POST(
      request({ name: "TypeError", message: "boom", stack: "at f (a.ts:1:1)", path: "/app/today" }),
    );

    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(mocks.createClientErrorReport).toHaveBeenCalledWith("user-1", {
      name: "TypeError",
      message: "boom",
      stack: "at f (a.ts:1:1)",
      path: "/app/today",
      release: null,
    });
  });

  it("checks the rate limit before touching the DAL, keyed per user", async () => {
    await POST(request({ name: "Error", message: "boom" }));

    expect(mocks.checkRateLimit).toHaveBeenCalledWith("api:client-errors:user-1", {
      limit: 10,
      windowSec: 60,
    });
  });

  it("returns 429 and never inserts when the rate limit is exceeded", async () => {
    mocks.checkRateLimit.mockResolvedValue({ allowed: false, remaining: 0, retryAfterSec: 60 });

    const response = await POST(request({ name: "Error", message: "boom" }));

    expect(response.status).toBe(429);
    expect(mocks.createClientErrorReport).not.toHaveBeenCalled();
  });

  it("rejects a body missing the required message field, without inserting", async () => {
    const response = await POST(request({ name: "Error" }));

    expect(response.status).toBe(400);
    expect(mocks.createClientErrorReport).not.toHaveBeenCalled();
  });

  it("truncates an overlong field instead of rejecting the request", async () => {
    const hugeMessage = "x".repeat(5000);
    const response = await POST(
      request({ name: "Error", message: hugeMessage }),
    );

    expect(response.status).toBe(204);
    const [, insertedInput] = mocks.createClientErrorReport.mock.calls[0] as [
      string,
      { message: string },
    ];
    expect(insertedInput.message).toHaveLength(2000);
    expect(insertedInput.message).toBe("x".repeat(2000));
  });

  it("redacts a secret in message/stack/path before it reaches the DAL", async () => {
    const response = await POST(
      request({
        name: "Error",
        message: "fetch failed: Bearer sk_live_abc123secret",
        stack: "Cookie: kairo_session=deadbeef\n  at f (a.ts:1:1)",
        path: "/app/today?token=leak-me",
      }),
    );

    expect(response.status).toBe(204);
    const [, insertedInput] = mocks.createClientErrorReport.mock.calls[0] as [
      string,
      { message: string; stack: string; path: string },
    ];
    expect(insertedInput.message).not.toContain("sk_live_abc123secret");
    expect(insertedInput.stack).not.toContain("deadbeef");
    expect(insertedInput.path).not.toContain("leak-me");
    expect(insertedInput.path).toBe("/app/today?token=[redacted]");
  });

  it("ignores a client-supplied userId/ownerId — the row is always owned by the session user", async () => {
    const response = await POST(
      request({
        name: "Error",
        message: "boom",
        userId: "mallory",
        ownerId: "mallory",
      }),
    );

    expect(response.status).toBe(204);
    expect(mocks.createClientErrorReport).toHaveBeenCalledWith(
      "user-1",
      expect.not.objectContaining({ userId: expect.anything() }),
    );
  });

  it("propagates the 401 from requireSession without touching the rate limiter or DAL", async () => {
    mocks.requireSession.mockRejectedValue(
      new Response(JSON.stringify({ error: { code: "unauthorized" } }), {
        status: 401,
      }),
    );

    const response = await POST(request({ name: "Error", message: "boom" }));

    expect(response.status).toBe(401);
    expect(mocks.checkRateLimit).not.toHaveBeenCalled();
    expect(mocks.createClientErrorReport).not.toHaveBeenCalled();
  });
});
