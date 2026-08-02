import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function inboxSource() {
  return readFileSync(
    resolve(process.cwd(), "src/components/InboxClient.tsx"),
    "utf8",
  );
}

describe("Inbox authentication boundary", () => {
  it("offers actionable sign-in paths instead of false signed-out mutations", () => {
    const source = inboxSource();

    expect(source).toContain('authPageHref("sign-in", "/app/inbox")');
    expect(source).toContain('authPageHref("sign-up", "/app/inbox")');
    expect(source).toContain("Sign in for AI grouping");
    expect(source).toContain("Sign in to capture");
    expect(source).not.toContain('setError("Sign in to save your thoughts.")');
    expect(source).not.toContain('disabled={!authed || busy === "group"');
  });

  it("retains the authenticated capture and scheduling paths", () => {
    const source = inboxSource();

    expect(source).toContain('placeholder="Get it out of your head…"');
    expect(source).toContain("sendReplaySafeCreate({");
    expect(source).toContain("groupByPriority");
    expect(source).toContain("scheduleToday");
  });
});
