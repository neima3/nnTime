import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = (path: string) =>
  readFileSync(new URL(path, import.meta.url), "utf8");

describe("Quick capture AI accept contract (SEC-05)", () => {
  it("never auto-saves from magicParse — only acceptProposal mutates", () => {
    const capture = source("./QuickCapture.tsx");
    const magicParse = capture.slice(
      capture.indexOf("const magicParse = useCallback"),
      capture.indexOf("const acceptProposal = useCallback"),
    );
    expect(magicParse).toContain("setProposal(draft)");
    expect(magicParse).not.toContain("sendReplaySafeCreate");
    expect(magicParse).not.toContain("router.refresh()");
  });

  it("preserves the proposal chip when accept fails", () => {
    const capture = source("./QuickCapture.tsx");
    const accept = capture.slice(
      capture.indexOf("const acceptProposal = useCallback"),
      capture.indexOf("const toggleVoice = useCallback"),
    );
    expect(accept).toContain("setProposal(null)");
    const failureCatch = accept.match(
      /} catch \{\s*toast\("Couldn't save — try again"\);\s*\}/,
    );
    expect(failureCatch).not.toBeNull();
    expect(failureCatch![0]).not.toContain("setProposal(null)");
  });
});
