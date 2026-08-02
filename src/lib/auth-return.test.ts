import { describe, expect, it } from "vitest";
import {
  appReturnTo,
  authPageHref,
  passwordRecoveryHref,
  safeAuthReturnTo,
} from "./auth-return";

describe("safeAuthReturnTo", () => {
  it.each([
    "/app",
    "/app/inbox",
    "/app/today?date=2026-08-01#now",
    "/app/inbox?filter=work%2Fhome",
    "/app/inbox?note=why%3Fnow%23later",
    "/app/inbox#section%2Fchild",
    "/onboarding",
  ])(
    "keeps an internal app destination: %s",
    (value) => expect(safeAuthReturnTo(value)).toBe(value),
  );

  it.each([
    undefined,
    ["/app/inbox"],
    "https://evil.example/app/inbox",
    "//evil.example/app/inbox",
    String.raw`/\\evil.example/app/inbox`,
    "/app/%5c%5cevil.example",
    "/app/%2fevil.example",
    "/app/%252fevil.example",
    "/app/%0aevil",
    "/app/%250aevil",
    "/app/%2e%2e/evil",
    "/app/%252e%252e//evil.example",
    "/app/%",
    "/app/%ZZ",
    "/sign-in",
    "/privacy",
    "/onboarding/",
    "/onboarding?next=%2Fapp%2Ftoday",
    "/onboarding#resume",
    "/onboarding%2fchild",
    "not-a-url",
  ])("fails closed for %j", (value) => {
    expect(safeAuthReturnTo(value)).toBe("/app/today");
  });

  it("builds encoded auth-page links from a safe destination", () => {
    expect(authPageHref("sign-in", "/app/inbox")).toBe(
      "/sign-in?next=%2Fapp%2Finbox",
    );
    expect(
      authPageHref("sign-up", "/app/inbox", { provider: "google" }),
    ).toBe("/sign-up?provider=google&next=%2Fapp%2Finbox");
  });

  it("builds password-recovery links from the same safe destination policy", () => {
    expect(
      passwordRecoveryHref(
        "forgot-password",
        "/app/inbox?filter=work%2Fhome",
      ),
    ).toBe(
      "/forgot-password?next=%2Fapp%2Finbox%3Ffilter%3Dwork%252Fhome",
    );
    expect(
      passwordRecoveryHref("reset-password", "https://evil.example/steal"),
    ).toBe("/reset-password?next=%2Fapp%2Ftoday");
  });

  it("serializes a normalized app intent deterministically", () => {
    expect(
      appReturnTo("/app/focus", {
        title: "Lunch",
        emoji: "🍜",
        duration: 45,
        activityId: "a5",
        occurrenceKey: undefined,
      }),
    ).toBe(
      "/app/focus?title=Lunch&emoji=%F0%9F%8D%9C&duration=45&activityId=a5",
    );
  });

  it("drops undefined values and fails unsafe paths closed", () => {
    expect(
      appReturnTo("/app/editor", { date: "2026-08-02", start: 540 }),
    ).toBe("/app/editor?date=2026-08-02&start=540");
    expect(appReturnTo("//evil.example", { value: "x" })).toBe(
      "/app/today",
    );
  });
});
