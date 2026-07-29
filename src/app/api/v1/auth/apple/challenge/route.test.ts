import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthCapabilities: vi.fn(),
  requireSession: vi.fn(),
  checkRateLimit: vi.fn(),
  rateLimitedResponse: vi.fn(),
  createAppleChallenge: vi.fn(),
}));

vi.mock("@/server/auth-capabilities", () => ({
  getAuthCapabilities: mocks.getAuthCapabilities,
}));
vi.mock("@/server/auth-session", () => ({
  requireSession: mocks.requireSession,
}));
vi.mock("@/server/ratelimit", () => ({
  checkRateLimit: mocks.checkRateLimit,
  rateLimitedResponse: mocks.rateLimitedResponse,
}));
vi.mock("@/server/native-apple-auth", () => ({
  createAppleChallenge: mocks.createAppleChallenge,
  postgresAppleChallengeStore: { kind: "postgres-store" },
}));

import { POST } from "./route";

function request(
  body: unknown,
  ip = "203.0.113.8",
  headers: Record<string, string> = {},
): Request {
  return new Request(
    "https://time.neima.me/api/v1/auth/apple/challenge",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-real-ip": ip,
        "x-forwarded-for": `198.51.100.99, ${ip}, 10.0.0.2`,
        ...headers,
      },
      body: JSON.stringify(body),
    },
  );
}

describe("POST /api/v1/auth/apple/challenge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAuthCapabilities.mockReturnValue({
      magicLink: true,
      apple: true,
    });
    mocks.checkRateLimit.mockResolvedValue({
      allowed: true,
      remaining: 9,
      retryAfterSec: 0,
    });
    mocks.requireSession.mockResolvedValue({
      userId: "user-7",
      sessionId: "session-7",
    });
    mocks.createAppleChallenge.mockResolvedValue({
      state: "state",
      nonce: "nonce",
      expiresAt: "2026-07-29T12:05:00.000Z",
    });
  });

  it("issues a public sign-in challenge behind the shared IP limit", async () => {
    const response = await POST(request({ intent: "sign_in" }));

    expect(response.status).toBe(201);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(mocks.requireSession).not.toHaveBeenCalled();
    expect(mocks.checkRateLimit).toHaveBeenCalledWith(
      "native-apple:challenge:ip:203.0.113.8",
      { limit: 10, windowSec: 60 },
    );
    expect(mocks.createAppleChallenge).toHaveBeenCalledWith(
      { intent: "sign_in" },
      { store: { kind: "postgres-store" } },
    );
  });

  it("binds linking to a session and applies a second per-user limit", async () => {
    const response = await POST(request({ intent: "link" }));

    expect(response.status).toBe(201);
    expect(mocks.requireSession).toHaveBeenCalledOnce();
    expect(mocks.checkRateLimit).toHaveBeenNthCalledWith(
      2,
      "native-apple:challenge:link:user:user-7",
      { limit: 5, windowSec: 60 },
    );
    expect(mocks.createAppleChallenge).toHaveBeenCalledWith(
      { intent: "link", userId: "user-7" },
      { store: { kind: "postgres-store" } },
    );
  });

  it("rejects cross-site browser linking before reading the session", async () => {
    const response = await POST(
      request(
        { intent: "link" },
        "203.0.113.8",
        {
          origin: "https://attacker.example",
          "sec-fetch-site": "cross-site",
        },
      ),
    );

    expect(response.status).toBe(403);
    expect(mocks.requireSession).not.toHaveBeenCalled();
    expect(mocks.createAppleChallenge).not.toHaveBeenCalled();
  });

  it("ignores spoofed forwarded chains for the public IP limit", async () => {
    await POST(request({ intent: "sign_in" }, "203.0.113.22"));

    expect(mocks.checkRateLimit).toHaveBeenCalledWith(
      "native-apple:challenge:ip:203.0.113.22",
      { limit: 10, windowSec: 60 },
    );
  });

  it("returns a standard 503 when Apple is not configured", async () => {
    mocks.getAuthCapabilities.mockReturnValue({
      magicLink: true,
      apple: false,
    });

    const response = await POST(request({ intent: "sign_in" }));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: {
        code: "apple_unavailable",
        message: "Sign in with Apple is not available.",
        retryable: false,
      },
    });
    expect(mocks.checkRateLimit).not.toHaveBeenCalled();
  });

  it("rejects unknown fields before issuing a challenge", async () => {
    const response = await POST(
      request({ intent: "sign_in", state: "client-controlled" }),
    );

    expect(response.status).toBe(400);
    expect(mocks.createAppleChallenge).not.toHaveBeenCalled();
  });

  it("forwards a shared-store rate-limit response", async () => {
    const limited = new Response("limited", { status: 429 });
    mocks.checkRateLimit.mockResolvedValueOnce({
      allowed: false,
      remaining: 0,
      retryAfterSec: 60,
    });
    mocks.rateLimitedResponse.mockReturnValue(limited);

    expect(await POST(request({ intent: "sign_in" }))).toBe(limited);
  });
});
