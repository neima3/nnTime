import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireSession: vi.fn(),
  listRoutines: vi.fn(),
  createRoutine: vi.fn(),
  listRoutineSteps: vi.fn(),
  listRoutineSchedules: vi.fn(),
  createRoutineSchedule: vi.fn(),
  withIdempotency: vi.fn(),
}));

vi.mock("@/server/auth-session", () => ({
  requireSession: mocks.requireSession,
}));

vi.mock("@/server/dal", () => ({
  ConflictError: class ConflictError extends Error {},
  NotFoundError: class NotFoundError extends Error {},
  listRoutines: mocks.listRoutines,
  createRoutine: mocks.createRoutine,
  listRoutineSteps: mocks.listRoutineSteps,
  listRoutineSchedules: mocks.listRoutineSchedules,
  createRoutineSchedule: mocks.createRoutineSchedule,
}));

vi.mock("@/server/idempotency", () => ({
  withIdempotency: mocks.withIdempotency,
}));

import { GET, POST } from "./route";

describe("POST /api/v1/routines", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireSession.mockResolvedValue({ userId: "user-1" });
    mocks.createRoutine.mockResolvedValue({
      id: "01980000-7000-8000-8000-000000000001",
      userId: "user-1",
      title: "Morning reset",
      revision: 1,
    });
    mocks.withIdempotency.mockImplementation(
      async (
        _userId: string,
        _key: string | null,
        _method: string,
        _path: string,
        execute: (db: unknown) => Promise<Response>,
      ) => execute("transaction-db"),
    );
  });

  it("delegates the complete routine bundle to one atomic DAL call", async () => {
    const response = await POST(
      new Request("https://time.neima.me/api/v1/routines", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": "routine-key-1",
        },
        body: JSON.stringify({
          title: "Morning reset",
          steps: [
            { title: "Stretch", durationMin: 5 },
            { title: "Plan", durationMin: 10 },
          ],
          schedule: {
            tz: "America/New_York",
            rrule: "FREQ=DAILY",
            paused: false,
          },
        }),
      }),
    );

    expect(response.status).toBe(201);
    expect(mocks.withIdempotency).toHaveBeenCalledWith(
      "user-1",
      "routine-key-1",
      "POST",
      "/api/v1/routines",
      expect.any(Function),
    );
    expect(mocks.createRoutine).toHaveBeenCalledTimes(1);
    expect(mocks.createRoutine).toHaveBeenCalledWith(
      "user-1",
      {
        title: "Morning reset",
        emoji: undefined,
        categoryId: undefined,
        notes: undefined,
        steps: [
          { title: "Stretch", durationMin: 5 },
          { title: "Plan", durationMin: 10 },
        ],
        schedule: {
          tz: "America/New_York",
          rrule: "FREQ=DAILY",
          paused: false,
        },
      },
      { db: "transaction-db" },
    );
    expect(mocks.createRoutineSchedule).not.toHaveBeenCalled();
  });
});

describe("GET /api/v1/routines", () => {
  it("returns computed totals above Int32 without truncation", async () => {
    vi.clearAllMocks();
    mocks.requireSession.mockResolvedValue({ userId: "user-1" });
    mocks.listRoutines.mockResolvedValue([
      {
        id: "01980000-7000-8000-8000-000000000001",
        userId: "user-1",
        title: "Large aggregate",
      },
    ]);
    mocks.listRoutineSteps.mockResolvedValue([
      { durationMin: 2_147_483_647 },
      { durationMin: 1 },
    ]);
    mocks.listRoutineSchedules.mockResolvedValue([]);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.items[0]).toMatchObject({
      stepCount: 2,
      totalMin: 2_147_483_648,
    });
  });

  it("returns a structured error instead of an unsafe total", async () => {
    vi.clearAllMocks();
    mocks.requireSession.mockResolvedValue({ userId: "user-1" });
    mocks.listRoutines.mockResolvedValue([
      {
        id: "01980000-7000-8000-8000-000000000001",
        userId: "user-1",
        title: "Unsafe aggregate",
      },
    ]);
    mocks.listRoutineSteps.mockResolvedValue([
      { durationMin: Number.MAX_SAFE_INTEGER },
      { durationMin: 1 },
    ]);
    mocks.listRoutineSchedules.mockResolvedValue([]);
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(body).toEqual({
      error: {
        code: "internal",
        message: "An unexpected error occurred",
        retryable: false,
      },
    });
    expect(body).not.toHaveProperty("items");
    expect(consoleError).toHaveBeenCalledOnce();
    consoleError.mockRestore();
  });
});
