import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(path: string): string {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

function between(contents: string, start: string, end: string): string {
  return contents.slice(contents.indexOf(start), contents.indexOf(end));
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

  it("routes every Quick Capture create through the typed boundary", () => {
    const contents = source("../components/QuickCapture.tsx");
    expect(contents).not.toMatch(
      /fetch\("\/api\/v1\/(?:tasks|activities)",[\s\S]*?method:\s*"POST"/,
    );
  });

  it.each([
    ["Activity Editor create", "../components/ActivityEditor.tsx", "sendReplaySafeCreate", "/api/v1/activities"],
    ["Review status", "../components/ReviewClient.tsx", "sendRebasedStatusChange", null],
    ["Mood check-in", "../components/StatsClient.tsx", "sendReplaySafeCreate", "/api/v1/mood"],
    ["Routine create", "../components/RoutinesClient.tsx", "sendReplaySafeCreate", "/api/v1/routines"],
    ["Peak Focus create", "../components/PeakFocusNudge.tsx", "sendReplaySafeCreate", "/api/v1/activities"],
  ])(
    "%s is covered without making unrelated mutations queueable",
    (_label, path, helper, directCreatePath) => {
      const contents = source(path);
      expect(contents).toContain(helper);
      if (directCreatePath) {
        const escaped = directCreatePath.replaceAll("/", "\\/");
        expect(contents).not.toMatch(
          new RegExp(
            `fetch\\("${escaped}",\\s*\\{\\s*method:\\s*"POST"`,
            "s",
          ),
        );
      }
    },
  );

  it("routes Inbox capture through the helper without queueing compound moves", () => {
    const contents = source("../components/InboxClient.tsx");
    const createHandler = between(
      contents,
      "const create = useCallback",
      "const remove = useCallback",
    );
    expect(createHandler).toContain("sendReplaySafeCreate");
    expect(createHandler).not.toContain('fetch("/api/v1/tasks"');
    expect(contents).toContain('method: "DELETE"');
    expect(contents).toContain('method: "PATCH"');
  });

  it("keeps unsafe edits, deletes, and focus transitions outside the helper", () => {
    expect(source("../components/ActivityEditor.tsx")).toContain(
      'method: "PATCH"',
    );
    expect(source("../components/InboxClient.tsx")).toContain(
      'method: "DELETE"',
    );
    expect(source("../components/FocusClient.tsx")).not.toContain(
      "sendReplaySafeCreate",
    );
    expect(source("../components/FocusClient.tsx")).not.toContain(
      "sendRebasedStatusChange",
    );
  });
});
