import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireSession: vi.fn(),
  deleteActivitySeries: vi.fn(),
  getActivitySeries: vi.fn(),
  appendPlannerEvent: vi.fn(),
  editSeriesOccurrence: vi.fn(),
  deleteSeriesOccurrence: vi.fn(),
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
  deleteSeriesOccurrence: mocks.deleteSeriesOccurrence,
}));

vi.mock("@/server/idempotency", () => ({
  withIdempotency: mocks.withIdempotency,
}));

import { DELETE, PATCH } from "./route";

const activityId = "01980000-7000-8000-8000-000000000001";
const successorId = "01980000-7000-8000-8000-000000000002";

function patchRequest(headers: Record<string, string>, body: object = {}) {
  return PATCH(
    new Request(`https://time.neima.me/api/v1/activities/${activityId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id: activityId }) },
  );
}

describe("PATCH /api/v1/activities/{id} canonical edits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireSession.mockResolvedValue({ userId: "user-1" });
    mocks.getActivitySeries.mockImplementation(async (_userId: string, id: string) =>
      id === successorId
        ? {
            id: successorId,
            userId: "user-1",
            dtstartLocal: new Date("2026-08-05T13:00:00.000Z"),
            title: "Successor",
            revision: 1,
          }
        : {
            id: activityId,
            userId: "user-1",
            dtstartLocal: new Date("2026-08-01T13:00:00.000Z"),
            title: "Predecessor",
            revision: 4,
          },
    );
    mocks.editSeriesOccurrence.mockResolvedValue({
      seriesId: successorId,
      revision: 1,
    });
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

  it("returns the split successor and coerces EXDATE on the locked database", async () => {
    const key = "01980000-7000-8000-8000-000000000099";
    const occurrenceKey = "2026-08-05T13:00:00.000Z";
    const response = await patchRequest(
      { "if-match": "4", "idempotency-key": key },
      {
        editScope: "this_and_future",
        occurrenceKey,
        exdate: ["2026-08-07"],
        title: "Successor",
      },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("etag")).toBe("1");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    await expect(response.json()).resolves.toMatchObject({
      id: successorId,
      title: "Successor",
      revision: 1,
    });
    expect(mocks.editSeriesOccurrence).toHaveBeenCalledWith(
      "user-1",
      activityId,
      new Date(occurrenceKey),
      "this_and_future",
      expect.objectContaining({
        exdate: [new Date("2026-08-07T00:00:00.000Z")],
        title: "Successor",
      }),
      4,
      { db: mocks.database },
    );
    expect(mocks.getActivitySeries).toHaveBeenLastCalledWith(
      "user-1",
      successorId,
      { db: mocks.database },
    );
  });

  it.each(["NaN", "0", "01", "1.5", "-1"])(
    "rejects malformed If-Match %s before mutation",
    async (ifMatch) => {
      const response = await patchRequest({ "if-match": ifMatch });

      expect(response.status).toBe(400);
      expect(response.headers.get("cache-control")).toBe("private, no-store");
      expect(mocks.withIdempotency).not.toHaveBeenCalled();
      expect(mocks.editSeriesOccurrence).not.toHaveBeenCalled();
    },
  );

  it("rejects a malformed idempotency key before mutation", async () => {
    const response = await patchRequest({
      "if-match": "4",
      "idempotency-key": "not-a-uuid",
    });

    expect(response.status).toBe(400);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(mocks.withIdempotency).not.toHaveBeenCalled();
    expect(mocks.editSeriesOccurrence).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/v1/activities/{id} idempotency", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireSession.mockResolvedValue({ userId: "user-1" });
    mocks.deleteActivitySeries.mockResolvedValue(undefined);
    mocks.deleteSeriesOccurrence.mockResolvedValue(undefined);
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
    const id = activityId;
    const response = await DELETE(
      new Request(`https://time.neima.me/api/v1/activities/${id}?editScope=all`, {
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
      `/api/v1/activities/${id}?editScope=all`,
      expect.any(Function),
    );
    expect(mocks.deleteActivitySeries).toHaveBeenCalledWith(
      "user-1",
      id,
      4,
      { db: mocks.database },
    );
  });

  it("defaults to a safe single-occurrence delete and requires its identity", async () => {
    const response = await DELETE(
      new Request(`https://time.neima.me/api/v1/activities/${activityId}`, {
        method: "DELETE",
        headers: { "if-match": "4" },
      }),
      { params: Promise.resolve({ id: activityId }) },
    );

    expect(response.status).toBe(400);
    expect(mocks.withIdempotency).not.toHaveBeenCalled();
    expect(mocks.deleteActivitySeries).not.toHaveBeenCalled();
  });

  it("routes a scoped delete through recurrence semantics", async () => {
    const occurrenceKey = "2026-08-05T13:00:00.000Z";
    const response = await DELETE(
      new Request(
        `https://time.neima.me/api/v1/activities/${activityId}?editScope=this_and_future&occurrenceKey=${encodeURIComponent(occurrenceKey)}`,
        { method: "DELETE", headers: { "if-match": "4" } },
      ),
      { params: Promise.resolve({ id: activityId }) },
    );

    expect(response.status).toBe(204);
    expect(mocks.deleteSeriesOccurrence).toHaveBeenCalledWith(
      "user-1",
      activityId,
      new Date(occurrenceKey),
      "this_and_future",
      4,
      { db: mocks.database },
    );
    expect(mocks.deleteActivitySeries).not.toHaveBeenCalled();
  });

  it("rejects incompatible occurrence and master fields", async () => {
    const occurrenceKey = "2026-08-05T13:00:00.000Z";
    const occurrenceResponse = await patchRequest(
      { "if-match": "4" },
      { editScope: "this", occurrenceKey, priority: "high" },
    );
    expect(occurrenceResponse.status).toBe(400);

    const masterResponse = await patchRequest(
      { "if-match": "4" },
      { editScope: "all", status: "completed" },
    );
    expect(masterResponse.status).toBe(400);
    expect(mocks.editSeriesOccurrence).not.toHaveBeenCalled();
  });

  it.each(["NaN", "0", "01", "1.5", "-1"])(
    "rejects malformed If-Match %s before delete",
    async (ifMatch) => {
      const response = await DELETE(
        new Request(`https://time.neima.me/api/v1/activities/${activityId}`, {
          method: "DELETE",
          headers: { "if-match": ifMatch },
        }),
        { params: Promise.resolve({ id: activityId }) },
      );

      expect(response.status).toBe(400);
      expect(mocks.withIdempotency).not.toHaveBeenCalled();
      expect(mocks.deleteActivitySeries).not.toHaveBeenCalled();
    },
  );

  it("rejects a malformed idempotency key before delete", async () => {
    const response = await DELETE(
      new Request(`https://time.neima.me/api/v1/activities/${activityId}`, {
        method: "DELETE",
        headers: {
          "if-match": "4",
          "idempotency-key": "not-a-uuid",
        },
      }),
      { params: Promise.resolve({ id: activityId }) },
    );

    expect(response.status).toBe(400);
    expect(mocks.withIdempotency).not.toHaveBeenCalled();
    expect(mocks.deleteActivitySeries).not.toHaveBeenCalled();
  });
});
