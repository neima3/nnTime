import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("signed-out auth return boundaries", () => {
  it("uses the safe auth-link helper in SignedOutCard", () => {
    const source = read("src/components/EmptyState.tsx");
    expect(source).toContain("returnTo: string");
    expect(source).toContain('authPageHref("sign-in", returnTo)');
    expect(source).toContain('authPageHref("sign-up", returnTo)');
    expect(source).not.toContain('href="/sign-in"');
    expect(source).not.toContain('href="/sign-up"');
  });

  it.each([
    ["src/app/app/routines/page.tsx", "/app/routines"],
    ["src/app/app/stats/page.tsx", "/app/stats"],
    ["src/app/app/settings/page.tsx", "/app/settings"],
    ["src/app/app/planner/page.tsx", "/app/planner"],
    ["src/components/StatsClient.tsx", "/app/stats"],
    ["src/components/SettingsClient.tsx", "/app/settings"],
  ])("pins %s to %s", (path, returnTo) => {
    expect(read(path)).toContain(`returnTo="${returnTo}"`);
  });

  it.each([
    ["src/app/app/focus/page.tsx", "/app/focus"],
    ["src/app/app/editor/page.tsx", "/app/editor"],
  ])("builds normalized dynamic intent for %s", (path, returnTo) => {
    const source = read(path);
    expect(source).toContain(`appReturnTo("${returnTo}", {`);
    expect(source).toContain("returnTo={returnTo}");
  });

  it("keeps the lazy game-loading gap modal and cancellable", () => {
    const source = read("src/components/PlayClient.tsx");
    expect(source).toContain("GameLoadingExitContext");
    expect(source).toContain("dialog.showModal()");
    expect(source).toContain('aria-label="Cancel opening game"');
    expect(source).toContain("onCancel=");
  });
});
