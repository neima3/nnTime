import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  headers: vi.fn(),
  ensureMigrated: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("./auth", () => ({
  auth: { api: { getSession: mocks.getSession } },
}));
vi.mock("./db/migrate-on-startup", () => ({
  ensureMigrated: mocks.ensureMigrated,
}));

import { getSession, requireSession } from "./auth-session";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.headers.mockResolvedValue(new Headers());
  mocks.getSession.mockResolvedValue(null);
  mocks.ensureMigrated.mockResolvedValue(undefined);
});

describe("auth session boundary", () => {
  it("returns null when no session cookie is present", async () => {
    await expect(getSession()).resolves.toBeNull();
  });

  it("returns the authenticated session", async () => {
    mocks.getSession.mockResolvedValue({
      user: { id: "user-a", name: "Ada", email: "ada@example.com" },
      session: { id: "session-a" },
    });

    await expect(getSession()).resolves.toEqual({
      userId: "user-a",
      sessionId: "session-a",
      user: { id: "user-a", name: "Ada", email: "ada@example.com" },
    });
  });

  it("rejects a queued mutation owned by another account", async () => {
    mocks.headers.mockResolvedValue(
      new Headers({ "X-Kairo-Queue-Owner": "user-a" }),
    );
    mocks.getSession.mockResolvedValue({
      user: { id: "user-b" },
      session: { id: "session-b" },
    });

    await expect(requireSession()).rejects.toMatchObject({ status: 403 });
  });

  it("allows the matching queue owner", async () => {
    mocks.headers.mockResolvedValue(
      new Headers({ "X-Kairo-Queue-Owner": "user-a" }),
    );
    mocks.getSession.mockResolvedValue({
      user: { id: "user-a", name: "Ada", email: "ada@example.com" },
      session: { id: "session-a" },
    });

    await expect(requireSession()).resolves.toEqual({
      userId: "user-a",
      sessionId: "session-a",
      user: { id: "user-a", name: "Ada", email: "ada@example.com" },
    });
  });
});

/**
 * A DB outage used to be indistinguishable from "signed out": getSession
 * swallowed every throw and returned null, so API routes answered 401 and
 * Server Components silently rendered the demo "Sample planner" in place of the
 * user's real day.
 */
describe("database failure is not a sign-out", () => {
  const dbDown = () => {
    mocks.ensureMigrated.mockRejectedValue(new Error("ECONNREFUSED"));
  };

  it("throws SessionUnavailableError when the database is configured but failing", async () => {
    vi.stubEnv("DATABASE_URL", "postgresql://user@localhost:5432/kairo");
    dbDown();
    await expect(getSession()).rejects.toThrow("Session store unavailable");
    vi.unstubAllEnvs();
  });

  it("answers 503 retryable — not 401 — from requireSession", async () => {
    vi.stubEnv("DATABASE_URL", "postgresql://user@localhost:5432/kairo");
    dbDown();
    const response = await requireSession().catch((e) => e);
    expect(response).toBeInstanceOf(Response);
    expect((response as Response).status).toBe(503);
    const body = await (response as Response).json();
    expect(body.error.code).toBe("service_unavailable");
    expect(body.error.retryable).toBe(true);
    vi.unstubAllEnvs();
  });

  it("stays lenient when no database is provisioned at all", async () => {
    vi.stubEnv("DATABASE_URL", "");
    dbDown();
    await expect(getSession()).resolves.toBeNull();
    vi.unstubAllEnvs();
  });

  it("lets Next's dynamic-rendering bail-out pass through untouched", async () => {
    // headers() throws this to opt a page out of static prerender. Wrapping it
    // broke `pnpm build` at the /app/editor prerender.
    vi.stubEnv("DATABASE_URL", "postgresql://user@localhost:5432/kairo");
    const bailout = Object.assign(new Error("Dynamic server usage"), {
      digest: "DYNAMIC_SERVER_USAGE",
    });
    mocks.ensureMigrated.mockRejectedValue(bailout);
    await expect(getSession()).rejects.toBe(bailout);
    vi.unstubAllEnvs();
  });
});
