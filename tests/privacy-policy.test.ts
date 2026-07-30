import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import PrivacyPage from "../src/app/privacy/page";
import { privacyPolicy } from "../src/lib/privacy-policy";

describe("public privacy policy", () => {
  it("states the implemented data and Apple Health boundaries", () => {
    const copy = JSON.stringify(privacyPolicy);

    expect(privacyPolicy.updated).toBe("July 29, 2026");
    expect(copy).toContain("email address");
    expect(copy).toContain("plans, tasks, routines, notes");
    expect(copy).toContain("never uploaded to Kairo");
    expect(copy).toContain("Anthropic");
    expect(copy).toContain("Resend");
    expect(copy).toContain("Google Calendar");
    expect(copy).toContain("Google identity");
    expect(copy).toContain("basic profile");
    expect(copy).toContain("separate");
    expect(copy).toContain("Apple Reminders");
    expect(copy).toContain("does not request access");
    expect(copy).toContain("do not sell");
    expect(copy).toContain("do not use advertising trackers");
    expect(copy).toContain("export");
    expect(copy).toContain("delete");
    expect(copy).toContain("neima@nakhaee.us");
  });

  it("does not claim certifications or guarantees Kairo has not earned", () => {
    const copy = JSON.stringify(privacyPolicy);
    expect(copy).not.toMatch(/HIPAA compliant|GDPR compliant|SOC 2|certified|100% secure/i);
  });

  it("renders one H1, sequential sections, and semantic landmarks", () => {
    const markup = renderToStaticMarkup(PrivacyPage());
    const h1Count = (markup.match(/<h1/g) ?? []).length;
    const h2Count = (markup.match(/<h2/g) ?? []).length;

    expect(h1Count).toBe(1);
    expect(h2Count).toBe(privacyPolicy.sections.length);
    expect(markup).toContain("<main");
    expect(markup).toContain('<nav aria-label="Privacy policy sections"');
    expect(markup).toContain("<article");
    expect(markup).toContain("Your plans are personal.");
    for (const section of privacyPolicy.sections) {
      expect(markup).toContain(`id="${section.id}"`);
    }
  });

  it("links the policy from the landing page and native Settings", () => {
    const landing = readFileSync(resolve("src/app/page.tsx"), "utf8");
    const nativeSettings = readFileSync(
      resolve("ios/App/Features/More/SettingsView.swift"),
      "utf8",
    );

    expect(landing).toContain('href="/privacy"');
    expect(nativeSettings).toContain('url: "https://time.neima.me/privacy"');
  });
});
