import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireSession: vi.fn(),
  deleteActivitySeries: vi.fn(),
  getActivitySeries: vi.fn(),
  appendPlannerEvent: vi.fn(),
  editSeriesOccurrence: vi.fn(),
  withIdempotency: vi.fn(),
  database: {},
}));

vi.mock("@/server/auth-session", () => ({
  requireSession: mocks.requireSession,
}));

vi.mock("@/server/dal", () => ({
  deleteActivitySeries: mocks.deleteActivitySeries,
  getActivitySeries: mocks.getActivitySeries,
  appendPlannerEvent: mocks.appendPlannerEvent,
  ConflictError: class ConflictError extends Error {},
  NotFoundError: class NotFoundError extends Error {},
}));

vi.mock("@/server/services/recurrence", () => ({
  editSeriesOccurrence: mocks.editSeriesOccurrence,
}));

vi.mock("@/server/idempotency", () => ({
  withIdempotency: mocks.withIdempotency,
}));

import { DELETE } from "./route";

describe("DELETE /api/v1/activities/{id} idempotency", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireSession.mockResolvedValue({ userId: "user-1" });
    mocks.deleteActivitySeries.mockResolvedValue(undefined);
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

  it("runs the tombstone delete on the locked idempotency database", async () => {
    const id = "01980000-7000-8000-8000-000000000001";
    const response = await DELETE(
      new Request(`https://time.neima.me/api/v1/activities/${id}`, {
        method: "DELETE",
        headers: {
          "if-match": "4",
          "idempotency-key": "01980000-7000-8000-8000-000000000099",
        },
      }),
      { params: Promise.resolve({ id }) },
    );

    expect(response.status).toBe(204);
    expect(mocks.withIdempotency).toHaveBeenCalledWith(
      "user-1",
      "01980000-7000-8000-8000-000000000099",
      "DELETE",
      `/api/v1/activities/${id}`,
      expect.any(Function),
    );
    expect(mocks.deleteActivitySeries).toHaveBeenCalledWith(
      "user-1",
      id,
      4,
      { db: mocks.database },
    );
  });
});
