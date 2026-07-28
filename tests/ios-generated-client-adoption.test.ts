import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { basename, resolve } from "node:path";
import { parse as parseYaml } from "yaml";

type SwiftFile = { name: string; source: string };

function readSwiftFiles(directory: string): SwiftFile[] {
  return readdirSync(resolve(directory), { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".swift"))
    .map((entry) => ({
      name: basename(entry.name),
      source: readFileSync(resolve(directory, entry.name), "utf8"),
    }));
}

function validateTestableImports(
  files: SwiftFile[],
  expectedModule: string,
): string[] {
  return files.flatMap((file) => {
    const imports = [
      ...file.source.matchAll(
        /^\s*@testable\s+import\s+([A-Za-z_][A-Za-z0-9_]*)\s*$/gm,
      ),
    ].map((match) => match[1]);

    if (imports.length === 1 && imports[0] === expectedModule) {
      return [];
    }

    return [
      `${file.name} must @testable import ${expectedModule} exactly once; found ${imports.join(", ") || "none"}`,
    ];
  });
}

const packageManifest = readFileSync(
  resolve("ios/Kairo/Package.swift"),
  "utf8",
);
const packageReadme = readFileSync(resolve("ios/Kairo/README.md"), "utf8");
const packageDeclarations = packageManifest
  .split("\n")
  .filter((line) => !line.trimStart().startsWith("//"))
  .join("\n");
const project = parseYaml(
  readFileSync(resolve("ios/project.yml"), "utf8"),
) as {
  packages?: Record<string, { path?: string }>;
  targets?: Record<
    string,
    {
      type?: string;
      dependencies?: Array<
        | string
        | {
            package?: string;
            product?: string;
            target?: string;
          }
      >;
    }
  >;
};
const packageTestFiles = readSwiftFiles("ios/Kairo/Tests/KairoTests");
const appUnitTestFiles = readSwiftFiles("ios/UnitTests");

describe("generated iOS client adoption", () => {
  it("exposes the existing Sources/Kairo tree as KairoAPIClient", () => {
    expect(packageDeclarations).toMatch(
      /\.library\(\s*name:\s*"KairoAPIClient",\s*targets:\s*\["KairoAPIClient"\]\s*\)/,
    );
    expect(packageDeclarations).toMatch(
      /\.target\(\s*name:\s*"KairoAPIClient",[\s\S]*?path:\s*"Sources\/Kairo",[\s\S]*?plugins:/,
    );
    expect(packageDeclarations).toMatch(
      /\.testTarget\(\s*name:\s*"KairoTests",\s*dependencies:\s*\["KairoAPIClient"\]\s*\)/,
    );
    expect(packageDeclarations).not.toMatch(
      /\.library\(\s*name:\s*"Kairo",/,
    );
  });

  it("imports KairoAPIClient from every Swift package test file", () => {
    expect(packageTestFiles.length).toBeGreaterThan(0);
    expect(
      validateTestableImports(packageTestFiles, "KairoAPIClient"),
    ).toEqual([]);
  });

  it("keeps every app-hosted unit test on the Kairo application module", () => {
    expect(appUnitTestFiles.length).toBeGreaterThan(0);
    expect(validateTestableImports(appUnitTestFiles, "Kairo")).toEqual([]);
  });

  it("rejects an app-hosted unit test that imports the client package", () => {
    const wrongModuleFixture = [
      {
        name: "WrongModuleTests.swift",
        source: "import XCTest\n@testable import KairoAPIClient\n",
      },
    ];

    expect(validateTestableImports(wrongModuleFixture, "Kairo")).toEqual([
      "WrongModuleTests.swift must @testable import Kairo exactly once; found KairoAPIClient",
    ]);
  });

  it("documents the current Swift package test count", () => {
    expect(packageReadme).toContain("44 tests across 8 suites.");
    expect(packageReadme).not.toContain("40 tests across 8 suites.");
  });

  it("links the local client product only to the shipping application", () => {
    expect(project.packages).toEqual({
      KairoAPIClient: { path: "Kairo" },
    });

    const linkedTargets = Object.entries(project.targets ?? {})
      .filter(([, target]) =>
        (target.dependencies ?? []).some(
          (dependency) =>
            typeof dependency === "object" &&
            dependency.package === "KairoAPIClient" &&
            dependency.product === "KairoAPIClient",
        ),
      )
      .map(([name]) => name);

    expect(linkedTargets).toEqual(["Kairo"]);
    expect(project.targets?.Kairo?.type).toBe("application");
  });
});
