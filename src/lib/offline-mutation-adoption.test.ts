import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(path: string): string {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

describe("offline mutation delivery adoption", () => {
  it.each([
    ["Quick Capture", "../components/QuickCapture.tsx", "sendReplaySafeCreate"],
    ["Today completion", "../components/TodayTimeline.tsx", "sendRebasedStatusChange"],
  ])("%s uses the typed delivery boundary", (_label, path, helper) => {
    const contents = source(path);
    expect(contents).toContain(helper);
    expect(contents).not.toMatch(/\benqueueMutation\b/);
  });
});
