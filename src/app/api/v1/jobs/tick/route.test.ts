import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const order: string[] = [];
  return {
    order,
    db: {},
    materializeRoutines: vi.fn(async () => {
      order.push("materialize");
      return {
        processed: 1,
        materialized: 1,
        skippedPaused: 0,
        skippedDuplicate: 0,
      };
    }),
    computeNotificationJobs: vi.fn(async () => {
      order.push("compute");
      return {
        desired: 3,
        created: 3,
        cancelled: 0,
        lockAcquired: true,
      };
    }),
    deliverDueNotificationJobs: vi.fn(async () => {
      order.push("deliver");
      return {
        considered: 1,
        delivered: 1,
        suppressed: 0,
        retried: 0,
        expired: 0,
        pruned: 0,
      };
    }),
    startSchedulerRun: vi.fn(async () => {
      order.push("start");
      return "019fa700-0000-7000-8000-000000000001";
    }),
    succeedSchedulerRun: vi.fn(async () => {
      order.push("succeed");
    }),
    failSchedulerRun: vi.fn(async () => {
      order.push("fail");
    }),
    pruneSchedulerRuns: vi.fn(async () => {
      order.push("prune");
      return 0;
    }),
    logger: {
      warn: vi.fn(),
      error: vi.fn(),
    },
  };
});

vi.mock("@/server/db", () => ({ default: mocks.db }));
vi.mock("@/server/services/routine-materializer", () => ({
  materializeRoutines: mocks.materializeRoutines,
}));
vi.mock("@/server/services/notifications", () => ({
  computeNotificationJobs: mocks.computeNotificationJobs,
}));
vi.mock("@/server/services/notification-delivery", () => ({
  deliverDueNotificationJobs: mocks.deliverDueNotificationJobs,
}));
vi.mock("@/server/services/scheduler-runs", () => ({
  startSchedulerRun: mocks.startSchedulerRun,
  succeedSchedulerRun: mocks.succeedSchedulerRun,
  failSchedulerRun: mocks.failSchedulerRun,
  pruneSchedulerRuns: mocks.pruneSchedulerRuns,
}));
vi.mock("@/server/log", () => ({ logger: mocks.logger }));

import { POST } from "./route";

const URL = "https://time.neima.me/api/v1/jobs/tick";

beforeEach(() => {
  vi.stubEnv("CRON_SECRET", "test-cron-secret");
  mocks.order.length = 0;
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("POST /api/v1/jobs/tick", () => {
  it("rejects an invalid secret before creating a run", async () => {
    const response = await POST(
      new Request(URL, {
        method: "POST",
        headers: { authorization: "Bearer wrong" },
      }),
    );

    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(mocks.order).toEqual([]);
  });

  it("fails closed in production when CRON_SECRET is missing", async () => {
    vi.stubEnv("CRON_SECRET", "");
    vi.stubEnv("NODE_ENV", "production");

    const response = await POST(new Request(URL, { method: "POST" }));

    expect(response.status).toBe(503);
    expect(mocks.order).toEqual([]);
  });

  it("records and returns one successful ordered scheduler run", async () => {
    const response = await POST(
      new Request(URL, {
        method: "POST",
        headers: { authorization: "Bearer test-cron-secret" },
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(mocks.order).toEqual([
      "start",
      "materialize",
      "compute",
      "deliver",
      "succeed",
      "prune",
    ]);
    expect(body).toMatchObject({
      ok: true,
      materialize: { materialized: 1 },
      notifications: { desired: 3, created: 3 },
      delivery: { considered: 1, delivered: 1 },
    });
    expect(mocks.succeedSchedulerRun).toHaveBeenCalledWith(
      mocks.db,
      "019fa700-0000-7000-8000-000000000001",
      expect.any(Date),
      {
        materialize: expect.objectContaining({ materialized: 1 }),
        notifications: expect.objectContaining({ created: 3 }),
        delivery: expect.objectContaining({ delivered: 1 }),
      },
    );
  });

  it.each(["materialize", "compute", "deliver"] as const)(
    "records %s failure and returns HTTP 500",
    async (stage) => {
      const failure =
        stage === "materialize"
          ? mocks.materializeRoutines
          : stage === "compute"
            ? mocks.computeNotificationJobs
            : mocks.deliverDueNotificationJobs;
      failure.mockRejectedValueOnce(new Error(`${stage} secret detail`));

      const response = await POST(
        new Request(URL, {
          method: "POST",
          headers: { "x-cron-secret": "test-cron-secret" },
        }),
      );
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body).toEqual({ ok: false, error: "scheduler tick failed" });
      expect(mocks.failSchedulerRun).toHaveBeenCalledWith(
        mocks.db,
        "019fa700-0000-7000-8000-000000000001",
        expect.any(Date),
        expect.objectContaining({ message: `${stage} secret detail` }),
      );
      expect(mocks.succeedSchedulerRun).not.toHaveBeenCalled();
      expect(mocks.pruneSchedulerRuns).not.toHaveBeenCalled();
    },
  );
});
