import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const CANARY_SECRETS = {
  DATABASE_URL: "postgresql://kairo:CANARY_DB_SECRET_x9f2@db.internal:5432/kairo",
  BETTER_AUTH_SECRET: "CANARY_BETTER_AUTH_SECRET_x9f2",
  CRON_SECRET: "CANARY_CRON_SECRET_x9f2",
  ANTHROPIC_API_KEY: "CANARY_ANTHROPIC_KEY_x9f2",
  RESEND_API_KEY: "re_CANARY_RESEND_x9f2",
} as const;

const provenanceMocks = vi.hoisted(() => ({
  getBuildProvenance: vi.fn(() => ({
    commit: "abc123def456789012345678901234567890abcd",
    builtAt: "2026-10-04T12:00:00.000Z",
  })),
}));

vi.mock("@/server/build-provenance", () => ({
  getBuildProvenance: provenanceMocks.getBuildProvenance,
}));

import { GET } from "./route";

beforeEach(() => {
  for (const [key, value] of Object.entries(CANARY_SECRETS)) {
    vi.stubEnv(key, value);
  }
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("GET /api/release", () => {
  it("returns embedded commit and build time only", async () => {
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(body).toEqual({
      commit: "abc123def456789012345678901234567890abcd",
      builtAt: "2026-10-04T12:00:00.000Z",
    });
    expect(Object.keys(body).sort()).toEqual(["builtAt", "commit"]);
  });

  it("does not leak environment variables or connection strings", async () => {
    const response = await GET();
    const bodyText = JSON.stringify(await response.json());
    const headerText = [...response.headers.entries()]
      .map(([k, v]) => `${k}:${v}`)
      .join("\n");

    for (const canary of Object.values(CANARY_SECRETS)) {
      expect(bodyText).not.toContain(canary);
      expect(headerText).not.toContain(canary);
    }
    expect(bodyText).not.toMatch(/postgresql:\/\//i);
    expect(bodyText).not.toMatch(/CANARY_/);
  });
});
