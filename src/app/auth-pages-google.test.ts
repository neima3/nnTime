import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthCapabilities: vi.fn(),
}));

vi.mock("@/server/auth-capabilities", () => ({
  getAuthCapabilities: mocks.getAuthCapabilities,
}));

import SignInPage from "./sign-in/page";
import SignUpPage from "./sign-up/page";
import { getGoogleAuthRedirectError } from "@/lib/auth-redirect-error";

describe("auth pages Google capability", () => {
  it.each([
    ["sign-in", SignInPage],
    ["sign-up", SignUpPage],
  ] as const)("passes only public auth capabilities to %s", async (_name, Page) => {
    const capabilities = Object.freeze({
      magicLink: true,
      apple: false,
      google: true,
    });
    mocks.getAuthCapabilities.mockReturnValue(capabilities);

    const element = await Page({ searchParams: Promise.resolve({}) });

    expect(mocks.getAuthCapabilities).toHaveBeenCalledWith(process.env);
    expect(element.props).toEqual(
      expect.objectContaining({
        capabilities,
      }),
    );
    expect(element.props).not.toHaveProperty("clientId");
    expect(element.props).not.toHaveProperty("clientSecret");
  });

  it.each([
    ["sign-in", SignInPage],
    ["sign-up", SignUpPage],
  ] as const)(
    "passes only a safe internal return destination to %s",
    async (_name, Page) => {
      const internal = await Page({
        searchParams: Promise.resolve({ next: "/app/inbox" }),
      });
      const external = await Page({
        searchParams: Promise.resolve({
          next: "https://evil.example/app/inbox",
        }),
      });

      expect(internal.props.returnTo).toBe("/app/inbox");
      expect(external.props.returnTo).toBe("/app/today");
    },
  );

  it.each([
    {
      query: {
        provider: "google",
        error: "account_not_linked",
        error_description: "client_secret=must-never-render",
      },
    },
    {
      query: {
        provider: "google",
        error: "OAUTH_LINK_ERROR",
        error_description: "User already exists. Use another email.",
      },
    },
    {
      query: {
        provider: "google",
        error: "account_already_linked_to_different_user",
      },
    },
  ])("maps account conflicts to explicit recovery copy: %#", ({ query }) => {
    const message = getGoogleAuthRedirectError(query);

    expect(message).toBe(
      "That Google account matches an existing Kairo account. Sign in with your existing method, then connect Google in Settings.",
    );
    expect(message).not.toContain("client_secret");
  });

  it.each([
    {
      query: {
        provider: "google",
        error: "access_denied",
        error_description: "User cancelled at Google",
      },
    },
    {
      query: {
        provider: "google",
        error: "invalid_code",
        error_description: "oauth payload: id_token=private",
      },
    },
  ])("maps allowlisted provider failures without reflecting descriptions: %#", ({ query }) => {
    const message = getGoogleAuthRedirectError(query);

    expect(message).toBe(
      "Google sign-in didn’t finish. Try again, or use another sign-in method.",
    );
    expect(message).not.toContain(query.error_description);
  });

  it("ignores unknown, array-shaped, and non-Google redirect payloads", () => {
    expect(
      getGoogleAuthRedirectError({
        provider: "google",
        error: "unknown_provider_payload",
        error_description: "<script>private</script>",
      }),
    ).toBeNull();
    expect(
      getGoogleAuthRedirectError({
        provider: "google",
        error: ["access_denied", "invalid_code"],
      }),
    ).toBeNull();
    expect(
      getGoogleAuthRedirectError({
        provider: "apple",
        error: "access_denied",
      }),
    ).toBeNull();
  });

  it.each([
    ["sign-in", SignInPage],
    ["sign-up", SignUpPage],
  ] as const)(
    "awaits redirected query params and passes safe initialError to %s",
    async (_name, Page) => {
      const element = await Page({
        searchParams: Promise.resolve({
          provider: "google",
          error: "OAUTH_LINK_ERROR",
          error_description: "client_secret=must-never-render",
        }),
      });

      expect(element.props.initialError).toBe(
        "That Google account matches an existing Kairo account. Sign in with your existing method, then connect Google in Settings.",
      );
      expect(JSON.stringify(element.props)).not.toContain("client_secret");
    },
  );
});
