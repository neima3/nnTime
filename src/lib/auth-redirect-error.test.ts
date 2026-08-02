import { describe, expect, it } from "vitest";
import { getMagicLinkRedirectError } from "./auth-redirect-error";

describe("magic-link redirect errors", () => {
  it("maps the invalid-token code to specific fixed recovery copy", () => {
    expect(getMagicLinkRedirectError({ error: "INVALID_TOKEN" })).toEqual({
      title: "This sign-in link isn’t available",
      body: "It may be incomplete, expired, or already used. Sign in to request a fresh link.",
    });
  });

  it.each([
    "failed_to_create_user",
    "new_user_signup_disabled",
    "failed_to_create_session",
  ])("maps %s to neutral fixed completion copy", (error) => {
    expect(getMagicLinkRedirectError({ error })).toEqual({
      title: "Kairo couldn’t complete sign-in",
      body: "Something went wrong while completing this sign-in link. Sign in to try again or choose another method.",
    });
  });

  it.each([
    {},
    { error: "attacker-controlled-copy" },
    { error: "constructor" },
    { error: "toString" },
    { error: "__proto__" },
    { error: ["INVALID_TOKEN"] },
  ])("ignores missing, unknown, and malformed values: %o", (searchParams) => {
    expect(getMagicLinkRedirectError(searchParams)).toBeNull();
  });
});
