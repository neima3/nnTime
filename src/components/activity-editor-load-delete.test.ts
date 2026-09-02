import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = (path: string) =>
  readFileSync(new URL(path, import.meta.url), "utf8");

function between(contents: string, start: string, end: string): string {
  return contents.slice(contents.indexOf(start), contents.indexOf(end));
}

describe("Activity editor load and delete", () => {
  it("surfaces a load failure instead of a blank new-looking sheet", () => {
    const editor = source("./ActivityEditor.tsx");
    expect(editor).toContain('useState<"loading" | "ready" | "failed">');
    expect(editor).toContain(
      "Couldn't load this activity — reopen it from the day view?",
    );
    expect(editor).toContain("Loading…");
    expect(editor).toContain("loadState !== \"ready\"");
    expect(editor).toContain("props.mode === \"edit\" && revision == null");
  });

  it("commitDelete always clears saving and toasts a thrown fetch", () => {
    const editor = source("./ActivityEditor.tsx");
    const commitDelete = between(
      editor,
      "const commitDelete = useCallback",
      "const asksScope = props.mode === \"edit\" && seriesRepeats",
    );
    expect(commitDelete).toContain("try {");
    expect(commitDelete).toContain("} catch {");
    expect(commitDelete).toContain("} finally {");
    expect(commitDelete).toContain('setError("Couldn\'t delete it — try again")');
    expect(commitDelete).toContain("setSaving(false)");
  });
});
