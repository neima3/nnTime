import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("ActivityEditor emoji preset accessibility", () => {
  it("gives every emoji preset button a spoken name", () => {
    const source = read("src/components/ActivityEditor.tsx");
    expect(source).toContain("EMOJI_PRESETS.map((e) => (");
    expect(source).toContain("aria-label={`Use ${e} as the icon`}");
  });
});
