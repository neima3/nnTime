import { describe, expect, it } from "vitest";
import { authPageHref, safeAuthReturnTo } from "./auth-return";

describe("safeAuthReturnTo", () => {
  it.each(["/app", "/app/inbox", "/app/today?date=2026-08-01#now"])(
    "keeps an internal app destination: %s",
    (value) => expect(safeAuthReturnTo(value)).toBe(value),
  );

  it.each([
    undefined,
    ["/app/inbox"],
    "https://evil.example/app/inbox",
    "//evil.example/app/inbox",
    String.raw`/\\evil.example/app/inbox`,
    "/sign-in",
    "/privacy",
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
});
