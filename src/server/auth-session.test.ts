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
      user: { id: "user-a" },
      session: { id: "session-a" },
    });

    await expect(getSession()).resolves.toEqual({
      userId: "user-a",
      sessionId: "session-a",
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
      user: { id: "user-a" },
      session: { id: "session-a" },
    });

    await expect(requireSession()).resolves.toEqual({
      userId: "user-a",
      sessionId: "session-a",
    });
  });
});
