import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireSession: vi.fn(),
  scheduleTask: vi.fn(),
  withIdempotency: vi.fn(),
  checkRateLimit: vi.fn(),
  database: {},
}));

vi.mock("@/server/auth-session", () => ({
  requireSession: mocks.requireSession,
}));

vi.mock("@/server/dal", () => ({
  scheduleTask: mocks.scheduleTask,
}));

vi.mock("@/server/idempotency", () => ({
  withIdempotency: mocks.withIdempotency,
}));

vi.mock("@/server/ratelimit", () => ({
  checkRateLimit: mocks.checkRateLimit,
  rateLimitedResponse: vi.fn(),
}));

import { POST } from "./route";

describe("POST /api/v1/tasks/{id}/schedule", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireSession.mockResolvedValue({ userId: "user-1" });
    mocks.scheduleTask.mockResolvedValue({ id: "series-1" });
    mocks.checkRateLimit.mockResolvedValue({ allowed: true });
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

  it("parses the canonical activity body on the locked idempotency database", async () => {
    const id = "01980000-7000-8000-8000-000000000001";
    const key = "01980000-7000-8000-8000-000000000099";
    const response = await POST(
      new Request(`https://time.neima.me/api/v1/tasks/${id}/schedule`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": key,
        },
        body: JSON.stringify({
          tz: "America/New_York",
          dtstartLocal: "2026-08-02T14:00:00.000Z",
          exdate: ["2026-08-03"],
          rdate: ["2026-08-04T14:00:00.000Z"],
          title: "Call the pharmacy",
          durationMin: 25,
          tags: ["01980000-7000-8000-8000-000000000077"],
          source: "manual",
          sourceRef: "inbox-conversion",
        }),
      }),
      { params: Promise.resolve({ id }) },
    );

    expect(response.status).toBe(201);
    expect(mocks.withIdempotency).toHaveBeenCalledWith(
      "user-1",
      key,
      "POST",
      `/api/v1/tasks/${id}/schedule`,
      expect.any(Function),
    );
    expect(mocks.checkRateLimit).toHaveBeenCalledWith(
      "api:tasks:schedule:user-1",
      { limit: 60, windowSec: 60 },
    );
    expect(mocks.scheduleTask).toHaveBeenCalledWith(
      "user-1",
      id,
      expect.objectContaining({
        dtstartLocal: new Date("2026-08-02T14:00:00.000Z"),
        title: "Call the pharmacy",
        durationMin: 25,
        exdate: [new Date("2026-08-03T00:00:00.000Z")],
        rdate: [new Date("2026-08-04T14:00:00.000Z")],
        tags: ["01980000-7000-8000-8000-000000000077"],
        sourceRef: "inbox-conversion",
      }),
      { db: mocks.database },
    );
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    await expect(response.json()).resolves.toEqual({ id: "series-1" });
  });

  it.each([
    ["not-a-uuid", "01980000-7000-8000-8000-000000000099"],
    ["01980000-7000-8000-8000-000000000001", "not-a-uuid"],
  ])("rejects malformed UUID parameters", async (id, key) => {
    const response = await POST(
      new Request(`https://time.neima.me/api/v1/tasks/${id}/schedule`, {
        method: "POST",
        headers: { "idempotency-key": key },
      }),
      { params: Promise.resolve({ id }) },
    );

    expect(response.status).toBe(400);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(mocks.withIdempotency).not.toHaveBeenCalled();
    expect(mocks.scheduleTask).not.toHaveBeenCalled();
  });

  it("requires an authenticated session", async () => {
    mocks.requireSession.mockRejectedValue(
      Response.json({ error: { code: "unauthorized" } }, { status: 401 }),
    );
    const id = "01980000-7000-8000-8000-000000000001";
    const response = await POST(
      new Request(`https://time.neima.me/api/v1/tasks/${id}/schedule`, {
        method: "POST",
      }),
      { params: Promise.resolve({ id }) },
    );

    expect(response.status).toBe(401);
    expect(mocks.withIdempotency).not.toHaveBeenCalled();
    expect(mocks.scheduleTask).not.toHaveBeenCalled();
  });
});
