/**
 * SEC-10 export is a full multi-table dump — rate limited so it can't be
 * looped into a data-exfiltration / load amplifier.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireSession: vi.fn(),
  checkRateLimit: vi.fn(),
  exportUserData: vi.fn(),
}));

vi.mock("@/server/auth-session", () => ({ requireSession: mocks.requireSession }));
vi.mock("@/server/ratelimit", async () => {
  const actual =
    await vi.importActual<typeof import("@/server/ratelimit")>("@/server/ratelimit");
  return { ...actual, checkRateLimit: mocks.checkRateLimit };
});
vi.mock("@/server/services/privacy", () => ({ exportUserData: mocks.exportUserData }));

import { GET } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireSession.mockResolvedValue({ userId: "user-1" });
  mocks.exportUserData.mockResolvedValue({ exportedAt: "2026-08-13T00:00:00.000Z" });
  mocks.checkRateLimit.mockResolvedValue({ allowed: true, remaining: 2, retryAfterSec: 0 });
});

describe("GET /api/v1/privacy/export", () => {
  it("rate limits per user before dumping data", async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    expect(mocks.checkRateLimit).toHaveBeenCalledWith("privacy:export:user-1", {
      limit: 3,
      windowSec: 3600,
    });
  });

  it("returns 429 and reads nothing once the limit is hit", async () => {
    mocks.checkRateLimit.mockResolvedValue({ allowed: false, remaining: 0, retryAfterSec: 3600 });

    const response = await GET();

    expect(response.status).toBe(429);
    expect((await response.json()).error.code).toBe("rate_limited");
    expect(mocks.exportUserData).not.toHaveBeenCalled();
  });
});
