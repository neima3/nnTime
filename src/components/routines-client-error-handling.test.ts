import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("RoutinesClient network failure toasts", () => {
  const source = read("src/components/RoutinesClient.tsx");

  it("toasts when togglePause throws instead of failing silently", () => {
    const start = source.indexOf("const togglePause = useCallback(");
    const end = source.indexOf("const remove = useCallback(");
    const togglePause = source.slice(start, end);
    expect(togglePause).toContain("try {");
    expect(togglePause).toContain(
      'toast("Couldn\'t update the schedule — try again")',
    );
    // Same copy on the !res.ok path and in the catch.
    expect(togglePause.match(/Couldn't update the schedule — try again/g))
      .toHaveLength(2);
  });

  it("toasts when remove throws and never removes the item", () => {
    const start = source.indexOf("const remove = useCallback(");
    const end = source.indexOf("const scheduleToday = useCallback(");
    const remove = source.slice(start, end);
    expect(remove).toContain("try {");
    expect(remove).toContain('toast("Couldn\'t delete it — try again")');
    expect(remove.match(/Couldn't delete it — try again/g)).toHaveLength(2);
    // setItems (the optimistic update) only happens inside the try.
    expect(remove.indexOf("setItems(")).toBeGreaterThan(remove.indexOf("try {"));
  });
});
