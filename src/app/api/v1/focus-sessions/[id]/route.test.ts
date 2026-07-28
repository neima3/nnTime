import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireSession: vi.fn(),
  transitionFocusSession: vi.fn(),
  extendFocusSession: vi.fn(),
  getRemainingSec: vi.fn(),
  appendPlannerEvent: vi.fn(),
  withIdempotency: vi.fn(),
  database: {},
}));

vi.mock("@/server/auth-session", () => ({
  requireSession: mocks.requireSession,
}));

vi.mock("@/server/services/focus", () => ({
  transitionFocusSession: mocks.transitionFocusSession,
  extendFocusSession: mocks.extendFocusSession,
  getRemainingSec: mocks.getRemainingSec,
}));

vi.mock("@/server/dal", () => ({
  appendPlannerEvent: mocks.appendPlannerEvent,
  ConflictError: class ConflictError extends Error {},
  NotFoundError: class NotFoundError extends Error {},
}));

vi.mock("@/server/idempotency", () => ({
  withIdempotency: mocks.withIdempotency,
}));

import { PATCH } from "./route";

const sessionRow = {
  id: "01980000-7000-8000-8000-000000000001",
  userId: "01980000-7000-8000-8000-000000000002",
  activityOccurrenceId: null,
  state: "paused",
  startedAt: new Date("2026-07-28T12:00:00.000Z"),
  targetDurationMin: 25,
  accumulatedPauseSec: 30,
  currentIntervalStartedAt: new Date("2026-07-28T12:10:00.000Z"),
  completionReason: null,
  revision: 2,
  createdAt: new Date("2026-07-28T12:00:00.000Z"),
  updatedAt: new Date("2026-07-28T12:10:00.000Z"),
};

describe("PATCH /api/v1/focus-sessions/{id}", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireSession.mockResolvedValue({ userId: sessionRow.userId });
    mocks.transitionFocusSession.mockResolvedValue(sessionRow);
    mocks.getRemainingSec.mockReturnValue(899);
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

  it("enforces the observed revision and wraps the mutation idempotently", async () => {
    const response = await PATCH(
      new Request(
        `https://time.neima.me/api/v1/focus-sessions/${sessionRow.id}`,
        {
          method: "PATCH",
          headers: {
            "content-type": "application/json",
            "if-match": "1",
            "idempotency-key": "01980000-7000-8000-8000-000000000099",
          },
          body: JSON.stringify({ action: "transition", state: "paused" }),
        },
      ),
      { params: Promise.resolve({ id: sessionRow.id }) },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toMatchObject({
      session: {
        id: sessionRow.id,
        startedAt: "2026-07-28T12:00:00.000Z",
        updatedAt: "2026-07-28T12:10:00.000Z",
      },
      remainingSec: 899,
    });
    expect(mocks.withIdempotency).toHaveBeenCalledWith(
      sessionRow.userId,
      "01980000-7000-8000-8000-000000000099",
      "PATCH",
      `/api/v1/focus-sessions/${sessionRow.id}`,
      expect.any(Function),
    );
    expect(mocks.transitionFocusSession).toHaveBeenCalledWith(
      sessionRow.userId,
      sessionRow.id,
      "paused",
      1,
      { db: mocks.database },
    );
  });

  it("requires If-Match before invoking the focus service", async () => {
    const response = await PATCH(
      new Request(
        `https://time.neima.me/api/v1/focus-sessions/${sessionRow.id}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "transition", state: "paused" }),
        },
      ),
      { params: Promise.resolve({ id: sessionRow.id }) },
    );

    expect(response.status).toBe(428);
    expect(await response.json()).toEqual({
      error: {
        code: "precondition_required",
        message: "If-Match header required",
        retryable: false,
      },
    });
    expect(mocks.transitionFocusSession).not.toHaveBeenCalled();
  });
});
