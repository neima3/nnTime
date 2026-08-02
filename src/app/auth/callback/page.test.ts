import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import MagicLinkCallbackPage from "./page";

describe("magic-link web fallback", () => {
  it("offers explicit app and browser actions without auto-verifying", async () => {
    const page = await MagicLinkCallbackPage({
      searchParams: Promise.resolve({ token: "single-use-token" }),
    });
    const html = renderToStaticMarkup(page);

    expect(html).toContain("Open Kairo on your iPhone");
    expect(html).not.toContain("this iPhone");
    expect(html).toContain("Open Kairo");
    expect(html).toContain("Continue in browser");
    expect(html).toContain("kairo://auth?token=single-use-token");
    expect(html).toContain(
      "/api/auth/magic-link/verify?token=single-use-token",
    );
    expect(html).not.toContain("http-equiv=\"refresh\"");
    expect(html).not.toContain("<script");
  });

  it("shows an expired-safe state when the token is missing", async () => {
    const page = await MagicLinkCallbackPage({
      searchParams: Promise.resolve({}),
    });
    const html = renderToStaticMarkup(page);

    expect(html).toContain("This link isn’t available");
    expect(html).not.toContain("kairo://auth");
    expect(html).not.toContain("/magic-link/verify");
  });
});
