import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireSession: vi.fn(),
  getActiveSession: vi.fn(),
  startFocusSession: vi.fn(),
  getRemainingSec: vi.fn(),
  appendPlannerEvent: vi.fn(),
}));

vi.mock("@/server/auth-session", () => ({
  requireSession: mocks.requireSession,
}));

vi.mock("@/server/services/focus", () => ({
  getActiveSession: mocks.getActiveSession,
  startFocusSession: mocks.startFocusSession,
  getRemainingSec: mocks.getRemainingSec,
}));

vi.mock("@/server/dal", () => ({
  appendPlannerEvent: mocks.appendPlannerEvent,
  ConflictError: class ConflictError extends Error {},
  NotFoundError: class NotFoundError extends Error {},
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
    mocks.appendPlannerEvent.mockResolvedValue(undefined);
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
        headers: { "content-type": "application/json" },
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
  });
});
