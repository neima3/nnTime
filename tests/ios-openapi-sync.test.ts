import { afterEach, describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

const script = resolve("scripts/sync-ios-openapi.mjs");
const tempDirs: string[] = [];

function fixture(canonical: string, native: string) {
  const dir = mkdtempSync(join(tmpdir(), "kairo-openapi-"));
  tempDirs.push(dir);
  const canonicalPath = join(dir, "canonical.yaml");
  const nativePath = join(dir, "native.yaml");
  writeFileSync(canonicalPath, canonical);
  writeFileSync(nativePath, native);
  return { canonicalPath, nativePath };
}

function run(
  args: string[],
  paths: { canonicalPath: string; nativePath: string },
) {
  const result = spawnSync(
    process.execPath,
    [script, ...args, paths.canonicalPath, paths.nativePath],
    { encoding: "utf8" },
  );
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout);
  }
  return result.stdout;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("iOS OpenAPI synchronization", () => {
  it("check mode accepts an exact copy without writing", () => {
    const paths = fixture("openapi: 3.1.0\n", "openapi: 3.1.0\n");

    const output = run(["--check"], paths);

    expect(output).toContain("in sync");
    expect(readFileSync(paths.nativePath, "utf8")).toBe("openapi: 3.1.0\n");
  });

  it("check mode rejects drift with the repair command", () => {
    const paths = fixture("canonical\n", "stale\n");

    expect(() => run(["--check"], paths)).toThrow(
      /pnpm api:sync-ios/,
    );
    expect(readFileSync(paths.nativePath, "utf8")).toBe("stale\n");
  });

  it("sync mode replaces the native copy byte-for-byte", () => {
    const paths = fixture("canonical\nwith: bytes\n", "stale\n");

    const output = run([], paths);

    expect(output).toContain("Synchronized");
    expect(readFileSync(paths.nativePath)).toEqual(
      readFileSync(paths.canonicalPath),
    );
  });
});
