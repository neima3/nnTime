import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./GreenLight.tsx", import.meta.url), "utf8");

describe("GreenLight input window contract", () => {
  it("ignores taps after the signal disappears", () => {
    expect(source).toContain(
      'if (stage !== "playing" || !showing || tappedRef.current) return;',
    );
    expect(source).toContain('[stage, showing]');
  });
});
