import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Overlay accessible-name contract.
 *
 * Every text control the modals move focus into must carry a programmatic
 * name — a placeholder alone leaves a screen-reader user on an anonymous edit
 * box, and it disappears the moment they type. These are source greps rather
 * than DOM tests because the vitest env is node-only; the live browser proof
 * lives in the a11y QA script.
 */
const root = process.cwd();
const read = (p: string) => readFileSync(resolve(root, p), "utf8");

/** The opening tag of the input/textarea that carries `placeholder`. */
function tagWithPlaceholder(source: string, placeholder: string): string {
  const at = source.indexOf(placeholder);
  expect(at, `placeholder ${placeholder} still exists`).toBeGreaterThan(-1);
  const start = source.lastIndexOf("<", at);
  const end = source.indexOf(">", at);
  return source.slice(start, end + 1);
}

const NAMED = /aria-label=|aria-labelledby=|\bid="/;

describe("overlay controls have accessible names", () => {
  it("names the quick capture input from its visible caption", () => {
    const src = read("src/components/QuickCapture.tsx");
    expect(src).toContain('id="quick-capture-label"');
    expect(tagWithPlaceholder(src, "One thought, then let it go…")).toContain(
      'aria-labelledby="quick-capture-label"',
    );
  });

  it("names the command palette search input", () => {
    const src = read("src/components/CommandPalette.tsx");
    expect(tagWithPlaceholder(src, "Jump anywhere, do anything…")).toMatch(
      /aria-label="[^"]+"/,
    );
  });

  it("names every activity editor field", () => {
    const src = read("src/components/ActivityEditor.tsx");
    expect(tagWithPlaceholder(src, "What are you doing?")).toMatch(NAMED);
    // Steps + Notes borrow their visible <label>, wired through Field htmlFor.
    expect(src).toContain('<Field label="Steps" htmlFor="activity-step-draft">');
    expect(src).toContain('id="activity-step-draft"');
    expect(src).toContain('<Field label="Notes" htmlFor="activity-notes">');
    expect(src).toContain('id="activity-notes"');
    expect(src).toContain("<label htmlFor={htmlFor}");
    for (const type of ['type="date"', 'type="time"', 'type="number"']) {
      const at = src.indexOf(type);
      expect(at, `${type} input exists`).toBeGreaterThan(-1);
      const tag = src.slice(src.lastIndexOf("<", at), src.indexOf("/>", at));
      expect(tag, `${type} input is named`).toMatch(/aria-label="[^"]+"/);
    }
  });

  it("names the new-routine dialog fields", () => {
    const src = read("src/components/RoutinesClient.tsx");
    expect(tagWithPlaceholder(src, "Morning reset")).toMatch(/aria-label="[^"]+"/);
    expect(tagWithPlaceholder(src, "One step per line")).toMatch(
      /aria-label="[^"]+"/,
    );
  });
});

describe("skip link lands somewhere", () => {
  it("makes #main-content programmatically focusable", () => {
    const src = read("src/components/AppShell.tsx");
    const at = src.indexOf('id="main-content"');
    expect(at).toBeGreaterThan(-1);
    const tag = src.slice(src.lastIndexOf("<", at), src.indexOf(">", at));
    expect(tag).toContain("tabIndex={-1}");
    expect(tag).toContain("outline-none");
  });

  it("keeps the skip link the first Tab stop after a programmatic scroll", () => {
    const src = read("src/components/AppShell.tsx");
    expect(src).toContain('e.key !== "Tab"');
    expect(src).toContain("skipRef.current.focus()");
  });
});

describe("one h1 per screen", () => {
  it("keeps the One thing overlay heading below the page h1", () => {
    const src = read("src/components/OneThing.tsx");
    expect(src).not.toMatch(/<h1[\s>]/);
    expect(src).toMatch(/<h2[\s>]/);
  });
});
