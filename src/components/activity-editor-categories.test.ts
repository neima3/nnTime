import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

describe("activity editor category readiness", () => {
  it("server-hydrates owned categories for every authenticated editor render", () => {
    const page = source("../app/app/editor/page.tsx");
    expect(page).toContain("const session = await getSession()");
    expect(page).toContain("listCategories(session.userId)");
    expect(page).not.toMatch(/listCategories\(session\.userId\)\.catch/);
    expect(page).toContain("initialCategories={categories.map");
    expect(page).not.toContain("const session = taskId ? await getSession() : null");
  });

  it("uses server categories immediately and retains the client refresh", () => {
    const editor = source("./ActivityEditor.tsx");
    expect(editor).toContain("initialCategories?: CategoryRow[]");
    expect(editor).toMatch(
      /useState<CategoryRow\[\]>\(\s*props\.initialCategories \?\? \[\],\s*\)/,
    );
    expect(editor).toContain('fetch("/api/v1/categories")');
  });
});
