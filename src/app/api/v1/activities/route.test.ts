import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireSession: vi.fn(),
  createActivitySeries: vi.fn(),
  listActivitySeries: vi.fn(),
  withIdempotency: vi.fn(),
  checkRateLimit: vi.fn(),
  database: {},
}));

vi.mock("@/server/auth-session", () => ({ requireSession: mocks.requireSession }));
vi.mock("@/server/dal", async () => {
  const actual = await vi.importActual<typeof import("@/server/dal")>(
    "@/server/dal",
  );
  return {
    ...actual,
    createActivitySeries: mocks.createActivitySeries,
    listActivitySeries: mocks.listActivitySeries,
  };
});
vi.mock("@/server/idempotency", () => ({ withIdempotency: mocks.withIdempotency }));
vi.mock("@/server/ratelimit", () => ({
  checkRateLimit: mocks.checkRateLimit,
  rateLimitedResponse: vi.fn(),
}));

import { NotFoundError } from "@/server/dal";
import { POST } from "./route";

describe("POST /api/v1/activities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireSession.mockResolvedValue({ userId: "user-1" });
    mocks.createActivitySeries.mockResolvedValue({ id: "series-1" });
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

  it("forwards the complete canonical body on the locked database", async () => {
    const key = "01980000-7000-8000-8000-000000000099";
    const tagId = "01980000-7000-8000-8000-000000000077";
    const response = await POST(
      new Request("https://time.neima.me/api/v1/activities", {
        method: "POST",
        headers: { "content-type": "application/json", "idempotency-key": key },
        body: JSON.stringify({
          tz: "America/New_York",
          dtstartLocal: "2026-08-02T14:00:00.000Z",
          rrule: "FREQ=DAILY",
          exdate: ["2026-08-03"],
          rdate: ["2026-08-04T14:00:00.000Z"],
          title: "Canonical create",
          durationMin: 25,
          tags: [tagId],
          sourceRef: "round54-contract",
        }),
      }),
    );

    expect(response.status).toBe(201);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(mocks.withIdempotency).toHaveBeenCalledWith(
      "user-1",
      key,
      "POST",
      "/api/v1/activities",
      expect.any(Function),
    );
    expect(mocks.createActivitySeries).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({
        exdate: [new Date("2026-08-03T00:00:00.000Z")],
        rdate: [new Date("2026-08-04T14:00:00.000Z")],
        tags: [tagId],
        sourceRef: "round54-contract",
      }),
      { db: mocks.database },
    );
  });

  it("rejects a malformed idempotency key before mutation", async () => {
    const response = await POST(
      new Request("https://time.neima.me/api/v1/activities", {
        method: "POST",
        headers: { "idempotency-key": "not-a-uuid" },
      }),
    );

    expect(response.status).toBe(400);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(mocks.checkRateLimit).not.toHaveBeenCalled();
    expect(mocks.withIdempotency).not.toHaveBeenCalled();
    expect(mocks.createActivitySeries).not.toHaveBeenCalled();
  });

  it("returns private not-found for inaccessible nested references", async () => {
    mocks.createActivitySeries.mockRejectedValue(new NotFoundError("category"));
    const response = await POST(
      new Request("https://time.neima.me/api/v1/activities", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tz: "UTC",
          dtstartLocal: "2026-08-02T14:00:00.000Z",
          title: "Cross-owner category",
          categoryId: "01980000-7000-8000-8000-000000000077",
          durationMin: 25,
        }),
      }),
    );

    expect(response.status).toBe(404);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "not_found", retryable: false },
    });
  });

  it("requires authentication before mutation", async () => {
    mocks.requireSession.mockRejectedValue(
      Response.json({ error: { code: "unauthorized" } }, { status: 401 }),
    );
    const response = await POST(
      new Request("https://time.neima.me/api/v1/activities", { method: "POST" }),
    );
    expect(response.status).toBe(401);
    expect(mocks.withIdempotency).not.toHaveBeenCalled();
    expect(mocks.createActivitySeries).not.toHaveBeenCalled();
  });
});
