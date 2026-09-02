import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = (path: string) =>
  readFileSync(new URL(path, import.meta.url), "utf8");

describe("Anytime rail scheduling adoption", () => {
  it("schedule() carries the task id into the editor", () => {
    const rail = source("./AnytimeRail.tsx");
    const schedule = rail.slice(
      rail.indexOf("const schedule = useCallback"),
      rail.indexOf("const dismiss = useCallback"),
    );
    expect(schedule).toContain("taskId: item.id");
    expect(schedule).toContain("title: item.title");
    expect(schedule).toContain("start: String(10 * 60)");
  });

  it("slotIt() uses the atomic task schedule endpoint", () => {
    const rail = source("./AnytimeRail.tsx");
    const slotIt = rail.slice(
      rail.indexOf("const slotIt = useCallback"),
      rail.indexOf("const schedule = useCallback"),
    );
    expect(slotIt).toContain("/api/v1/tasks/${item.id}/schedule");
    expect(slotIt).not.toContain('fetch("/api/v1/activities"');
    expect(slotIt).not.toContain('method: "DELETE"');
    expect(slotIt).toContain("Couldn't slot it — try Schedule instead");
  });
});
