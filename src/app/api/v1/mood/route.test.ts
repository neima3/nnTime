import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireSession: vi.fn(),
  recordMoodCheckin: vi.fn(),
  withIdempotency: vi.fn(),
  database: {},
}));

vi.mock("@/server/auth-session", () => ({
  requireSession: mocks.requireSession,
}));

vi.mock("@/server/services/stats", () => ({
  recordMoodCheckin: mocks.recordMoodCheckin,
}));

vi.mock("@/server/idempotency", () => ({
  withIdempotency: mocks.withIdempotency,
}));

import { POST } from "./route";

function request(body: unknown, idempotencyKey?: string) {
  return new Request("https://time.neima.me/api/v1/mood", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(idempotencyKey ? { "idempotency-key": idempotencyKey } : {}),
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/v1/mood", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireSession.mockResolvedValue({ userId: "user-1" });
    mocks.recordMoodCheckin.mockResolvedValue(undefined);
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

  it("records the closed mood value and optional note", async () => {
    const response = await POST(request({ mood: "good", note: "Steady day" }));

    expect(response.status).toBe(201);
    expect(mocks.recordMoodCheckin).toHaveBeenCalledWith(
      "user-1",
      "good",
      "Steady day",
      { db: mocks.database },
    );
    expect(await response.json()).toEqual({ ok: true });
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it("rejects an unknown mood without writing", async () => {
    const response = await POST(request({ mood: "excellent" }));

    expect(response.status).toBe(400);
    expect(mocks.recordMoodCheckin).not.toHaveBeenCalled();
  });

  it("rejects a note longer than 500 characters without writing", async () => {
    const response = await POST(
      request({ mood: "okay", note: "x".repeat(501) }),
    );

    expect(response.status).toBe(400);
    expect(mocks.recordMoodCheckin).not.toHaveBeenCalled();
  });

  it("replays a keyed response without recording a second mood", async () => {
    let stored:
      | { status: number; body: unknown }
      | undefined;
    mocks.withIdempotency.mockImplementation(
      async (
        _userId: string,
        _key: string | null,
        _method: string,
        _path: string,
        execute: (database: object) => Promise<Response>,
      ) => {
        if (stored) {
          return Response.json(stored.body, {
            status: stored.status,
            headers: {
              "cache-control": "private, no-store",
              "idempotent-replay": "true",
            },
          });
        }
        const response = await execute(mocks.database);
        stored = {
          status: response.status,
          body: await response.clone().json(),
        };
        return response;
      },
    );

    const first = await POST(
      request({ mood: "great" }, "01980000-7000-8000-8000-000000000099"),
    );
    const replay = await POST(
      request({ mood: "great" }, "01980000-7000-8000-8000-000000000099"),
    );

    expect(first.status).toBe(201);
    expect(replay.status).toBe(201);
    expect(replay.headers.get("idempotent-replay")).toBe("true");
    expect(await replay.json()).toEqual({ ok: true });
    expect(mocks.recordMoodCheckin).toHaveBeenCalledTimes(1);
    expect(mocks.withIdempotency).toHaveBeenNthCalledWith(
      1,
      "user-1",
      "01980000-7000-8000-8000-000000000099",
      "POST",
      "/api/v1/mood",
      expect.any(Function),
    );
  });
});
