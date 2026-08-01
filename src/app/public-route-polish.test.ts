import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ForgotPasswordPage from "./forgot-password/page";
import { metadata as forgotPasswordMetadata } from "./forgot-password/layout";
import { metadata as onboardingMetadata } from "./onboarding/layout";

describe("public route polish", () => {
  it.each([
    ["forgot-password", forgotPasswordMetadata, "Reset your password · Kairo"],
    ["onboarding", onboardingMetadata, "Set up your planner · Kairo"],
  ])("gives %s a specific document title", (_route, metadata, title) => {
    expect(metadata.title).toBe(title);
  });

  it("keeps password recovery inside the branded auth shell", () => {
    const html = renderToStaticMarkup(createElement(ForgotPasswordPage));

    expect(html).toContain('href="/"');
    expect(html).toContain(">Kairo</span>");
  });

  it("does not probe protected settings until onboarding has a session", () => {
    const source = readFileSync(resolve(__dirname, "onboarding/page.tsx"), "utf8");
    const sessionGuard = source.indexOf("if (!data?.user) return;");
    const settingsRequest = source.indexOf('fetch("/api/v1/settings"');

    expect(source).toContain("const { data, isPending } = useSession();");
    expect(sessionGuard).toBeGreaterThan(-1);
    expect(settingsRequest).toBeGreaterThan(sessionGuard);
  });
});
