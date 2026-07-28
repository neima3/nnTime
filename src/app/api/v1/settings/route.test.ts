import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireSession: vi.fn(),
  getOrCreateSettings: vi.fn(),
  updateSettings: vi.fn(),
  withIdempotency: vi.fn(),
  database: {},
}));

vi.mock("@/server/auth-session", () => ({
  requireSession: mocks.requireSession,
}));

vi.mock("@/server/dal", () => ({
  getOrCreateSettings: mocks.getOrCreateSettings,
  updateSettings: mocks.updateSettings,
  ConflictError: class ConflictError extends Error {},
  NotFoundError: class NotFoundError extends Error {},
}));

vi.mock("@/server/idempotency", () => ({
  withIdempotency: mocks.withIdempotency,
}));

import { PATCH } from "./route";

describe("PATCH /api/v1/settings idempotency", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireSession.mockResolvedValue({ userId: "user-1" });
    mocks.updateSettings.mockResolvedValue({
      userId: "user-1",
      timezone: "UTC",
      locale: "en-US",
      weekStart: 1,
      hourCycle: "h12",
      theme: "dark",
      reducedStimulation: false,
      notificationPrefs: {},
      schemaVersion: 1,
      revision: 2,
      createdAt: new Date("2026-07-28T12:00:00.000Z"),
      updatedAt: new Date("2026-07-28T12:01:00.000Z"),
    });
    mocks.withIdempotency.mockImplementation(
      async (
        _userId: string,
        _key: string | null,
        _method: string,
        _path: string,
        execute: (database: object) => Promise<Response>,
      ) => execute(mocks.database),
    );
  });

  it("runs the settings update on the locked idempotency database", async () => {
    const response = await PATCH(
      new Request("https://time.neima.me/api/v1/settings", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          "if-match": "1",
          "idempotency-key": "01980000-7000-8000-8000-000000000099",
        },
        body: JSON.stringify({ theme: "dark" }),
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.withIdempotency).toHaveBeenCalledWith(
      "user-1",
      "01980000-7000-8000-8000-000000000099",
      "PATCH",
      "/api/v1/settings",
      expect.any(Function),
    );
    expect(mocks.updateSettings).toHaveBeenCalledWith(
      "user-1",
      { theme: "dark" },
      1,
      { db: mocks.database },
    );
  });
});
