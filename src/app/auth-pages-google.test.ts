import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthCapabilities: vi.fn(),
}));

vi.mock("@/server/auth-capabilities", () => ({
  getAuthCapabilities: mocks.getAuthCapabilities,
}));

import SignInPage from "./sign-in/page";
import SignUpPage from "./sign-up/page";

describe("auth pages Google capability", () => {
  it.each([
    ["sign-in", SignInPage],
    ["sign-up", SignUpPage],
  ] as const)("passes only public auth capabilities to %s", (_name, Page) => {
    const capabilities = Object.freeze({
      magicLink: true,
      apple: false,
      google: true,
    });
    mocks.getAuthCapabilities.mockReturnValue(capabilities);

    const element = Page();

    expect(mocks.getAuthCapabilities).toHaveBeenCalledWith(process.env);
    expect(element.props).toEqual(
      expect.objectContaining({
        capabilities,
      }),
    );
    expect(element.props).not.toHaveProperty("clientId");
    expect(element.props).not.toHaveProperty("clientSecret");
  });
});
