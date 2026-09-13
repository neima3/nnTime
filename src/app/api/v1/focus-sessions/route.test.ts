import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireSession: vi.fn(),
  getActiveSession: vi.fn(),
  startFocusSession: vi.fn(),
  getRemainingSec: vi.fn(),
  presentFocusSession: vi.fn(),
  appendPlannerEvent: vi.fn(),
  withIdempotency: vi.fn(),
  database: {},
}));

vi.mock("@/server/auth-session", () => ({
  requireSession: mocks.requireSession,
}));

vi.mock("@/server/services/focus", () => ({
  getActiveSession: mocks.getActiveSession,
  startFocusSession: mocks.startFocusSession,
  getRemainingSec: mocks.getRemainingSec,
  presentFocusSession: mocks.presentFocusSession,
}));

vi.mock("@/server/dal", () => ({
  appendPlannerEvent: mocks.appendPlannerEvent,
  ConflictError: class ConflictError extends Error {},
  NotFoundError: class NotFoundError extends Error {},
  BadRequestError: class BadRequestError extends Error {},
}));

vi.mock("@/server/idempotency", () => ({
  withIdempotency: mocks.withIdempotency,
}));

import { GET, POST } from "./route";

const sessionRow = {
  id: "01980000-7000-8000-8000-000000000001",
  userId: "01980000-7000-8000-8000-000000000002",
  activityOccurrenceId: null,
  state: "running",
  startedAt: new Date("2026-07-28T12:00:00.000Z"),
  targetDurationMin: 25,
  accumulatedPauseSec: 0,
  currentIntervalStartedAt: new Date("2026-07-28T12:00:00.000Z"),
  completionReason: null,
  revision: 1,
  createdAt: new Date("2026-07-28T12:00:00.000Z"),
  updatedAt: new Date("2026-07-28T12:00:00.000Z"),
};

describe("/api/v1/focus-sessions wire responses", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireSession.mockResolvedValue({ userId: sessionRow.userId });
    mocks.getRemainingSec.mockReturnValue(1499);
    mocks.presentFocusSession.mockImplementation(
      async (_userId: string, session: typeof sessionRow) => ({
        ...session,
        activitySeriesId: null,
        occurrenceKey: null,
      }),
    );
    mocks.appendPlannerEvent.mockResolvedValue(undefined);
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

  it("serializes a production-shaped active session row", async () => {
    mocks.getActiveSession.mockResolvedValue(sessionRow);

    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toMatchObject({
      session: {
        id: sessionRow.id,
        startedAt: "2026-07-28T12:00:00.000Z",
        currentIntervalStartedAt: "2026-07-28T12:00:00.000Z",
        createdAt: "2026-07-28T12:00:00.000Z",
        updatedAt: "2026-07-28T12:00:00.000Z",
      },
      remainingSec: 1499,
    });
  });

  it("serializes the committed row before returning a successful start", async () => {
    mocks.startFocusSession.mockResolvedValue(sessionRow);

    const response = await POST(
      new Request("https://time.neima.me/api/v1/focus-sessions", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": "01980000-7000-8000-8000-000000000099",
        },
        body: JSON.stringify({ targetDurationMin: 25 }),
      }),
    );

    expect(response.status).toBe(201);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toMatchObject({
      session: {
        id: sessionRow.id,
        startedAt: "2026-07-28T12:00:00.000Z",
      },
      remainingSec: 1499,
    });
    expect(mocks.withIdempotency).toHaveBeenCalledWith(
      sessionRow.userId,
      "01980000-7000-8000-8000-000000000099",
      "POST",
      "/api/v1/focus-sessions",
      expect.any(Function),
    );
    expect(mocks.startFocusSession).toHaveBeenCalledWith(
      sessionRow.userId,
      {
        targetDurationMin: 25,
        activityOccurrenceId: undefined,
        activitySeriesId: undefined,
        occurrenceKey: undefined,
      },
      { db: mocks.database },
    );
    expect(mocks.appendPlannerEvent).toHaveBeenCalledWith(
      sessionRow.userId,
      expect.objectContaining({
        entityType: "focus_session",
        eventType: "focus_start",
      }),
      { db: mocks.database },
    );
  });

  it("rejects an incomplete virtual-occurrence selector before starting", async () => {
    const response = await POST(
      new Request("https://time.neima.me/api/v1/focus-sessions", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": "01980000-7000-8000-8000-000000000099",
        },
        body: JSON.stringify({
          targetDurationMin: 25,
          activitySeriesId: "01980000-7000-8000-8000-000000000010",
        }),
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: { code: "bad_request" },
    });
    expect(mocks.startFocusSession).not.toHaveBeenCalled();
  });

  it("fails the start when the planner event write fails (no swallow)", async () => {
    mocks.startFocusSession.mockResolvedValue(sessionRow);
    mocks.appendPlannerEvent.mockRejectedValue(
      new Error("planner event write failed"),
    );

    const response = await POST(
      new Request("https://time.neima.me/api/v1/focus-sessions", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": "01980000-7000-8000-8000-000000000099",
        },
        body: JSON.stringify({ targetDurationMin: 25 }),
      }),
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({
      error: { code: "internal", retryable: false },
    });
  });
});
