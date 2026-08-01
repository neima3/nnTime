import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = (path: string) =>
  readFileSync(new URL(path, import.meta.url), "utf8");

describe("Inbox task scheduling adoption", () => {
  it("carries source identity from Inbox into the editor", () => {
    expect(source("./InboxClient.tsx")).toContain("taskId: item.id");
    expect(source("../app/app/editor/page.tsx")).toContain(
      "sourceTaskId={id ? undefined : taskId}",
    );
    expect(source("../app/app/editor/page.tsx")).toContain(
      "initialCategoryId={task?.categoryId ?? undefined}",
    );
  });

  it("uses the atomic conversion endpoint instead of generic offline create", () => {
    const editor = source("./ActivityEditor.tsx");
    expect(editor).toContain("props.sourceTaskId");
    expect(editor).toContain("/api/v1/tasks/${props.sourceTaskId}/schedule");
    expect(editor).toContain("Task scheduling needs a connection");
    expect(editor).toContain("props.initialCategoryId");
  });
});
