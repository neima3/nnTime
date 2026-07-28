import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireSession: vi.fn(),
  getStats: vi.fn(),
}));

vi.mock("@/server/auth-session", () => ({
  requireSession: mocks.requireSession,
}));

vi.mock("@/server/services/stats", () => ({
  getStats: mocks.getStats,
}));

import { GET } from "./route";

function statsResult() {
  return {
    byDate: {},
    streak: { current: 0, best: 0 },
    energyBalance: { low: 0, medium: 0, high: 0 },
    totalCompleted: 0,
    totalFocusMin: 0,
    estimate: null,
    focusHours: null,
    energyPattern: {
      byHour: Array.from({ length: 24 }, () => 0),
      sampled: 0,
      window: null,
    },
  };
}

describe("GET /api/v1/stats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-28T12:00:00.000Z"));
    mocks.requireSession.mockResolvedValue({ userId: "user-1" });
    mocks.getStats.mockResolvedValue(statsResult());
  });

  it("uses the documented 14-day default", async () => {
    const response = await GET(new Request("https://time.neima.me/api/v1/stats"));

    expect(response.status).toBe(200);
    expect(mocks.getStats).toHaveBeenCalledWith("user-1", {
      from: new Date("2026-07-14T12:00:00.000Z"),
      to: new Date("2026-07-28T12:00:00.000Z"),
    });
    expect(await response.json()).toMatchObject({ days: 14 });
  });

  it("uses a valid bounded days query", async () => {
    const response = await GET(
      new Request("https://time.neima.me/api/v1/stats?days=30"),
    );

    expect(response.status).toBe(200);
    expect(mocks.getStats).toHaveBeenCalledWith("user-1", {
      from: new Date("2026-06-28T12:00:00.000Z"),
      to: new Date("2026-07-28T12:00:00.000Z"),
    });
    expect(await response.json()).toMatchObject({ days: 30 });
  });

  it.each(["not-a-number", "1.5", "0", "-2", "91", ""])(
    "returns the standard 400 envelope for invalid days %s",
    async (days) => {
      const response = await GET(
        new Request(
          `https://time.neima.me/api/v1/stats?days=${encodeURIComponent(days)}`,
        ),
      );

      expect(response.status).toBe(400);
      expect(response.headers.get("cache-control")).toBe("private, no-store");
      expect(await response.json()).toMatchObject({
        error: {
          code: "bad_request",
          message: "Validation failed",
          retryable: false,
        },
      });
      expect(mocks.getStats).not.toHaveBeenCalled();
    },
  );

  it("rejects duplicate days parameters instead of choosing one", async () => {
    const response = await GET(
      new Request(
        "https://time.neima.me/api/v1/stats?days=7&days=14",
      ),
    );

    expect(response.status).toBe(400);
    expect(mocks.getStats).not.toHaveBeenCalled();
  });

  it("fails closed when the service violates the response contract", async () => {
    mocks.getStats.mockResolvedValue({ ...statsResult(), totalCompleted: -1 });

    const response = await GET(new Request("https://time.neima.me/api/v1/stats"));

    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({
      error: { code: "internal", retryable: false },
    });
  });
});
