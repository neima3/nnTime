/**
 * Deleting an account must also end the session.
 *
 * The user row cascades its sessions away, but Better Auth's cookieCache
 * (maxAge 5 min) resolves a session straight from the signed cookie without
 * touching the database — so in QA the deleted account stayed "signed in":
 * GET /api/v1/tasks answered 200 and settings/day answered 500 (they tried to
 * write rows for a user id that no longer existed) instead of 401.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireSession: vi.fn(),
  deleteAccount: vi.fn(),
}));

vi.mock("@/server/auth-session", () => ({ requireSession: mocks.requireSession }));
vi.mock("@/server/services/privacy", () => ({ deleteAccount: mocks.deleteAccount }));

import { DELETE } from "./route";

const confirmed = () =>
  new Request("http://localhost/api/v1/privacy/account", {
    method: "DELETE",
    headers: { confirm: "delete-my-account" },
  });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireSession.mockResolvedValue({ userId: "user-1" });
  mocks.deleteAccount.mockResolvedValue(undefined);
});

describe("DELETE /api/v1/privacy/account", () => {
  it("deletes the account and returns 204", async () => {
    const res = await DELETE(confirmed());
    expect(res.status).toBe(204);
    expect(mocks.deleteAccount).toHaveBeenCalledWith("user-1");
  });

  it("expires the session token and the cookie-cache payload", async () => {
    const res = await DELETE(confirmed());
    const cookies = res.headers.getSetCookie();

    // Both cookies matter: the token authenticates, session_data is the cache
    // that kept answering for up to five minutes without a DB lookup.
    const names = cookies.map((c) => c.split("=")[0]);
    expect(names).toContain("better-auth.session_token");
    expect(names).toContain("better-auth.session_data");
    // Production sets the __Secure- prefixed variants.
    expect(names).toContain("__Secure-better-auth.session_token");
    expect(names).toContain("__Secure-better-auth.session_data");

    for (const cookie of cookies) {
      expect(cookie).toMatch(/Max-Age=0/);
      expect(cookie).toMatch(/Path=\//);
      expect(cookie).toMatch(/HttpOnly/);
    }
    // Only the __Secure- variants may carry the Secure attribute — a plain
    // cookie marked Secure would not be cleared over http in development.
    for (const cookie of cookies) {
      if (cookie.startsWith("__Secure-")) expect(cookie).toMatch(/Secure/);
      else expect(cookie).not.toMatch(/; Secure/);
    }
  });

  it("does not delete or clear cookies without the confirm header", async () => {
    const res = await DELETE(
      new Request("http://localhost/api/v1/privacy/account", { method: "DELETE" }),
    );
    expect(res.status).toBe(428);
    expect(mocks.deleteAccount).not.toHaveBeenCalled();
    expect(res.headers.getSetCookie()).toHaveLength(0);
  });
});
