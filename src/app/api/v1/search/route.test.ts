import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireSession: vi.fn(),
  getOrCreateSettings: vi.fn(),
  listActivitySeries: vi.fn(),
  listTasks: vi.fn(),
}));

vi.mock("@/server/auth-session", () => ({
  requireSession: mocks.requireSession,
}));

vi.mock("@/server/dal", () => ({
  getOrCreateSettings: mocks.getOrCreateSettings,
  listActivitySeries: mocks.listActivitySeries,
  listTasks: mocks.listTasks,
}));

import { GET } from "./route";

const SERIES_ID = "01980000-7000-8000-8000-000000000001";
const TASK_ID = "01980000-7000-8000-8000-000000000002";

describe("GET /api/v1/search", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireSession.mockResolvedValue({ userId: "user-scoped" });
    mocks.getOrCreateSettings.mockResolvedValue({
      timezone: "America/New_York",
    });
    mocks.listActivitySeries.mockResolvedValue([
      {
        id: SERIES_ID,
        title: "Dentist checkup",
        notes: "bring insurance card",
        emoji: "🦷",
        dtstartLocal: new Date("2026-07-24T14:00:00.000Z"),
        tz: "America/New_York",
        rrule: "FREQ=WEEKLY",
        categoryId: null,
      },
    ]);
    mocks.listTasks.mockResolvedValue([
      {
        id: TASK_ID,
        title: "Call pharmacy",
        notes: null,
        emoji: "💊",
        date: null,
        categoryId: null,
        convertedTo: null,
      },
    ]);
  });

  it("requires a non-empty q", async () => {
    const response = await GET(
      new Request("https://time.neima.me/api/v1/search?q="),
    );
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("bad_request");
  });

  it("loads candidates only for the authenticated user", async () => {
    const response = await GET(
      new Request("https://time.neima.me/api/v1/search?q=dentist&limit=5"),
    );
    expect(response.status).toBe(200);
    expect(mocks.listActivitySeries).toHaveBeenCalledWith("user-scoped");
    expect(mocks.listTasks).toHaveBeenCalledWith("user-scoped");

    const body = await response.json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0]).toMatchObject({
      id: SERIES_ID,
      kind: "activity",
      title: "Dentist checkup",
      date: "2026-07-24",
      startMin: 600,
      matchedOn: "title",
      repeats: true,
    });
    expect(body.zone).toBe("America/New_York");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it("returns an empty items array when nothing matches", async () => {
    const response = await GET(
      new Request("https://time.neima.me/api/v1/search?q=zzznomatch"),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.items).toEqual([]);
    expect(body.query).toBe("zzznomatch");
  });
});
