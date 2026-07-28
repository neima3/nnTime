import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { basename, resolve } from "node:path";
import { parse as parseYaml } from "yaml";

const packageManifest = readFileSync(
  resolve("ios/Kairo/Package.swift"),
  "utf8",
);
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
const packageTestFiles = readdirSync(
  resolve("ios/Kairo/Tests/KairoTests"),
  { withFileTypes: true },
)
  .filter((entry) => entry.isFile() && entry.name.endsWith(".swift"))
  .map((entry) => ({
    name: basename(entry.name),
    source: readFileSync(
      resolve("ios/Kairo/Tests/KairoTests", entry.name),
      "utf8",
    ),
  }));

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

    for (const file of packageTestFiles) {
      const imports = [
        ...file.source.matchAll(
          /^\s*@testable\s+import\s+([A-Za-z_][A-Za-z0-9_]*)\s*$/gm,
        ),
      ].map((match) => match[1]);

      expect(imports, file.name).toEqual(["KairoAPIClient"]);
    }
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
