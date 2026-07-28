import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireSession: vi.fn(),
  transitionFocusSession: vi.fn(),
  extendFocusSession: vi.fn(),
  getRemainingSec: vi.fn(),
  appendPlannerEvent: vi.fn(),
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
  });

  it("serializes a production-shaped row after the mutation commits", async () => {
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
  });
});
