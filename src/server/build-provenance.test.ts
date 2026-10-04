import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { getBuildProvenance } from "./build-provenance";

describe("build provenance module", () => {
  it("exposes commit and optional builtAt without reading process.env", () => {
    const source = readFileSync(resolve("src/server/build-provenance.ts"), "utf8");
    expect(source).not.toMatch(/process\.env\./);

    const provenance = getBuildProvenance();
    expect(provenance.commit).toMatch(/^[0-9a-f]{40}$|^development$|^unknown$/);
    expect(
      provenance.builtAt === null ||
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(provenance.builtAt),
    ).toBe(true);
  });
});
