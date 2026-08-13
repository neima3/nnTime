/**
 * The test-nudge endpoint is a send loop if unlimited — it must consume a
 * per-user bucket before any push goes out.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireSession: vi.fn(),
  checkRateLimit: vi.fn(),
  sendToUser: vi.fn(),
  pushConfigured: vi.fn(),
}));

vi.mock("@/server/auth-session", () => ({ requireSession: mocks.requireSession }));
vi.mock("@/server/ratelimit", async () => {
  const actual =
    await vi.importActual<typeof import("@/server/ratelimit")>("@/server/ratelimit");
  return { ...actual, checkRateLimit: mocks.checkRateLimit };
});
vi.mock("@/server/services/push", () => ({
  sendToUser: mocks.sendToUser,
  pushConfigured: mocks.pushConfigured,
}));

import { POST } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireSession.mockResolvedValue({ userId: "user-1" });
  mocks.pushConfigured.mockReturnValue(true);
  mocks.sendToUser.mockResolvedValue({ sent: 1, failed: 0 });
  mocks.checkRateLimit.mockResolvedValue({ allowed: true, remaining: 4, retryAfterSec: 0 });
});

describe("POST /api/v1/push/test", () => {
  it("rate limits per user before sending", async () => {
    const response = await POST();

    expect(response.status).toBe(200);
    expect(mocks.checkRateLimit).toHaveBeenCalledWith("push:test:user-1", {
      limit: 5,
      windowSec: 3600,
    });
    expect(mocks.sendToUser).toHaveBeenCalledOnce();
  });

  it("returns 429 and sends nothing once the limit is hit", async () => {
    mocks.checkRateLimit.mockResolvedValue({ allowed: false, remaining: 0, retryAfterSec: 3600 });

    const response = await POST();

    expect(response.status).toBe(429);
    expect((await response.json()).error.code).toBe("rate_limited");
    expect(mocks.sendToUser).not.toHaveBeenCalled();
  });
});
