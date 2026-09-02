import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = (path: string) =>
  readFileSync(new URL(path, import.meta.url), "utf8");

describe("Plan my day accept adopts the source task", () => {
  it("accept() sends taskId so the editor can schedule atomically", () => {
    const client = source("./PlanDayClient.tsx");
    const accept = client.slice(
      client.indexOf("function accept(item: Proposal)"),
      client.indexOf("toast(\"Opening editor — confirm to save\")"),
    );
    expect(accept).toContain("taskId: item.taskId");
    expect(accept).toContain("title: item.title ?? \"Planned task\"");
    expect(accept).toContain("start: String(mins)");
  });
});
