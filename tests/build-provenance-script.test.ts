import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("write-build-provenance.mjs", () => {
  it("writes a typed module with commit and ISO build time", () => {
    execFileSync("node", ["scripts/write-build-provenance.mjs"], {
      cwd: resolve("."),
    });
    const generated = readFileSync(
      resolve("src/server/build-provenance.generated.ts"),
      "utf8",
    );
    expect(generated).toContain("export const BUILD_PROVENANCE");
    expect(generated).toMatch(/commit: "[0-9a-f]{40}"/);
    expect(generated).toMatch(
      /builtAt: "\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z"/,
    );
    expect(generated).not.toContain("process.env");
  });
});
