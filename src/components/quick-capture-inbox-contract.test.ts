import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = (path: string) =>
  readFileSync(new URL(path, import.meta.url), "utf8");

function between(contents: string, start: string, end: string): string {
  return contents.slice(contents.indexOf(start), contents.indexOf(end));
}

describe("Quick capture inbox refresh", () => {
  it("save() refreshes the router and announces inbox changes", () => {
    const capture = source("./QuickCapture.tsx");
    const save = between(
      capture,
      "const save = useCallback",
      "const magicParse = useCallback",
    );
    expect(save).toContain("router.refresh()");
    expect(save).toContain('window.dispatchEvent(new Event("kairo:inbox-changed"))');
    expect(capture).toMatch(/import \{[^}]*\buseRouter\b[^}]*\} from "next\/navigation"/);
  });

  it("InboxClient adopts a refreshed server list without remounting", () => {
    const inbox = source("./InboxClient.tsx");
    expect(inbox).toContain("const [prevInitial, setPrevInitial] = useState(initialItems)");
    expect(inbox).toContain("if (initialItems !== prevInitial)");
    expect(inbox).toContain("setItems(initialItems)");
    expect(inbox).toContain('window.addEventListener("kairo:inbox-changed"');
    expect(inbox).toContain("router.refresh()");
  });

  it("magicParse failure falls back to a real plain save", () => {
    const capture = source("./QuickCapture.tsx");
    const magicParse = between(
      capture,
      "const magicParse = useCallback",
      "const acceptProposal = useCallback",
    );
    expect(magicParse).toContain("await save(false)");
    expect(magicParse).toContain("Magic add is resting — saving as plain text");
    expect(magicParse).not.toContain("captured as plain text");
  });
});
