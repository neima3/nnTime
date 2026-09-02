import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/lib/auth-client", () => ({
  useSession: () => ({ data: null, isPending: true, error: null }),
  signOut: vi.fn(),
}));

vi.mock("@/lib/offline-queue", () => ({
  forgetUser: vi.fn(),
  purgeUserCache: vi.fn(),
}));

import { AppSessionProvider } from "./AppSessionBoundary";
import { UserMenu } from "./UserMenu";

const seeded = {
  id: "user-a",
  name: "Ada Lovelace",
  email: "ada@example.com",
};

describe("UserMenu", () => {
  it("renders the server-seeded identity while the session probe is pending", () => {
    const markup = renderToStaticMarkup(
      React.createElement(
        AppSessionProvider,
        { signedIn: true, user: seeded },
        React.createElement(UserMenu),
      ),
    );

    expect(markup).toContain("Ada Lovelace");
    expect(markup).toContain("ada@example.com");
    expect(markup).not.toContain("animate-pulse");
  });

  it("keeps the placeholder when no context user is available", () => {
    const markup = renderToStaticMarkup(
      React.createElement(
        AppSessionProvider,
        { signedIn: true },
        React.createElement(UserMenu),
      ),
    );

    expect(markup).toContain("animate-pulse");
    expect(markup).not.toContain("Ada Lovelace");
    expect(markup).not.toContain("Sign in");
  });
});
