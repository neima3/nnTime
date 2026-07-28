import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  db: {
    execute: vi.fn().mockResolvedValue([{ "?column?": 1 }]),
  },
  ensureMigrated: vi.fn().mockResolvedValue(undefined),
  getMigrationStatus: vi.fn(() => ({ ok: true })),
  getSchedulerHealth: vi.fn(),
}));

vi.mock("@/server/db", () => ({ default: mocks.db }));
vi.mock("@/server/db/migrate-on-startup", () => ({
  ensureMigrated: mocks.ensureMigrated,
  getMigrationStatus: mocks.getMigrationStatus,
}));
vi.mock("@/server/services/scheduler-runs", () => ({
  getSchedulerHealth: mocks.getSchedulerHealth,
}));

import { GET } from "./route";

beforeEach(() => {
  vi.stubEnv("DATABASE_URL", "postgresql://test.invalid/kairo");
  vi.stubEnv("CRON_SECRET", "test-cron-secret");
  vi.stubEnv("NODE_ENV", "test");
  vi.clearAllMocks();
  mocks.getMigrationStatus.mockReturnValue({ ok: true });
  mocks.db.execute.mockResolvedValue([{ "?column?": 1 }]);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("GET /api/health scheduler honesty", () => {
  it("reports recent scheduler success and lag", async () => {
    mocks.getSchedulerHealth.mockResolvedValue({
      state: "ok",
      lagSeconds: 42,
    });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(body).toMatchObject({
      status: "ok",
      checks: {
        migrate: "ok",
        db: "ok",
        ai: "unconfigured",
        scheduler: "ok",
      },
      schedulerLagSeconds: 42,
    });
    expect(mocks.getSchedulerHealth).toHaveBeenCalledWith(
      expect.objectContaining({
        db: mocks.db,
        configured: true,
        now: expect.any(Date),
        processStartedAt: expect.any(Date),
      }),
    );
  });

  it.each([
    ["lagging", 601],
    ["failed", 180],
  ] as const)("degrades for %s scheduler state", async (state, lagSeconds) => {
    mocks.getSchedulerHealth.mockResolvedValue({ state, lagSeconds });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toMatchObject({
      status: "degraded",
      checks: { scheduler: state },
      schedulerLagSeconds: lagSeconds,
    });
  });

  it("allows bounded scheduler warming", async () => {
    mocks.getSchedulerHealth.mockResolvedValue({
      state: "warming",
      lagSeconds: null,
    });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("ok");
    expect(body.checks.scheduler).toBe("warming");
    expect(body.schedulerLagSeconds).toBeNull();
  });

  it("allows unconfigured scheduler outside production", async () => {
    vi.stubEnv("CRON_SECRET", "");
    mocks.getSchedulerHealth.mockResolvedValue({
      state: "unconfigured",
      lagSeconds: null,
    });

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      status: "ok",
      checks: { scheduler: "unconfigured" },
    });
  });

  it("degrades an unconfigured production scheduler", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("CRON_SECRET", "");
    mocks.getSchedulerHealth.mockResolvedValue({
      state: "unconfigured",
      lagSeconds: null,
    });

    const response = await GET();

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      status: "degraded",
      checks: { scheduler: "unconfigured" },
    });
  });
});
