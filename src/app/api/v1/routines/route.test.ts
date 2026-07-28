import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireSession: vi.fn(),
  listRoutines: vi.fn(),
  createRoutine: vi.fn(),
  listRoutineSteps: vi.fn(),
  listRoutineSchedules: vi.fn(),
  createRoutineSchedule: vi.fn(),
}));

vi.mock("@/server/auth-session", () => ({
  requireSession: mocks.requireSession,
}));

vi.mock("@/server/dal", () => ({
  listRoutines: mocks.listRoutines,
  createRoutine: mocks.createRoutine,
  listRoutineSteps: mocks.listRoutineSteps,
  listRoutineSchedules: mocks.listRoutineSchedules,
  createRoutineSchedule: mocks.createRoutineSchedule,
}));

import { POST } from "./route";

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
  });

  it("delegates the complete routine bundle to one atomic DAL call", async () => {
    const response = await POST(
      new Request("https://time.neima.me/api/v1/routines", {
        method: "POST",
        headers: { "content-type": "application/json" },
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
    expect(mocks.createRoutine).toHaveBeenCalledTimes(1);
    expect(mocks.createRoutine).toHaveBeenCalledWith("user-1", {
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
    });
    expect(mocks.createRoutineSchedule).not.toHaveBeenCalled();
  });
});
