import { afterEach, describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join, relative, resolve } from "node:path";
import { tmpdir } from "node:os";
import { parse as parseYaml } from "yaml";

type SwiftFile = { name: string; source: string };
type PackageDump = {
  products?: Array<{
    name?: string;
    targets?: string[];
    type?: { library?: string[] };
  }>;
  targets?: Array<{
    name?: string;
    type?: string;
    path?: string;
    dependencies?: Array<{ byName?: [string, unknown] }>;
    pluginUsages?: Array<{ plugin?: [string, string] }>;
  }>;
};
type Project = {
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

const tempDirs: string[] = [];

function readSwiftFiles(directory: string): SwiftFile[] {
  const root = resolve(directory);
  const files: SwiftFile[] = [];

  function walk(currentDirectory: string) {
    for (const entry of readdirSync(currentDirectory, {
      withFileTypes: true,
    }).sort((left, right) => left.name.localeCompare(right.name))) {
      const path = join(currentDirectory, entry.name);
      if (entry.isDirectory()) {
        walk(path);
      } else if (entry.isFile() && entry.name.endsWith(".swift")) {
        files.push({
          name: relative(root, path).split("\\").join("/"),
          source: readFileSync(path, "utf8"),
        });
      }
    }
  }

  walk(root);
  return files;
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

function validatePackageDump(packageDump: PackageDump): string[] {
  const diagnostics: string[] = [];
  const product = packageDump.products?.find(
    (candidate) => candidate.name === "KairoAPIClient",
  );
  if (!product) {
    diagnostics.push("KairoAPIClient library product is required");
  } else {
    if (!product.type?.library) {
      diagnostics.push("KairoAPIClient product must be a library");
    }
    if (
      product.targets?.length !== 1 ||
      product.targets[0] !== "KairoAPIClient"
    ) {
      diagnostics.push(
        "KairoAPIClient product must expose only the KairoAPIClient target",
      );
    }
  }

  const clientTarget = packageDump.targets?.find(
    (target) => target.name === "KairoAPIClient",
  );
  if (!clientTarget) {
    diagnostics.push("KairoAPIClient package target is required");
  } else {
    if (clientTarget.type !== "regular") {
      diagnostics.push("KairoAPIClient target must be regular");
    }
    if (clientTarget.path !== "Sources/Kairo") {
      diagnostics.push("KairoAPIClient target path must be Sources/Kairo");
    }
    const hasGenerator = clientTarget.pluginUsages?.some(
      (usage) =>
        usage.plugin?.[0] === "OpenAPIGenerator" &&
        usage.plugin[1] === "swift-openapi-generator",
    );
    if (!hasGenerator) {
      diagnostics.push(
        "KairoAPIClient target must use swift-openapi-generator/OpenAPIGenerator",
      );
    }
  }

  const testTarget = packageDump.targets?.find(
    (target) => target.name === "KairoTests",
  );
  if (!testTarget) {
    diagnostics.push("KairoTests package target is required");
  } else {
    if (testTarget.type !== "test") {
      diagnostics.push("KairoTests target must be a test target");
    }
    const testsClient = testTarget.dependencies?.some(
      (dependency) => dependency.byName?.[0] === "KairoAPIClient",
    );
    if (!testsClient) {
      diagnostics.push("KairoTests must depend on KairoAPIClient");
    }
  }

  return diagnostics;
}

function validateProjectPackageUsage(project: Project): string[] {
  const diagnostics: string[] = [];

  if (project.packages?.KairoAPIClient?.path !== "Kairo") {
    diagnostics.push("KairoAPIClient local package path must be Kairo");
  }

  const app = project.targets?.Kairo;
  if (app?.type !== "application") {
    diagnostics.push("Kairo must remain the shipping application target");
  }
  const appConsumesClient = app?.dependencies?.some(
    (dependency) =>
      typeof dependency === "object" &&
      dependency.package === "KairoAPIClient" &&
      dependency.product === "KairoAPIClient",
  );
  if (!appConsumesClient) {
    diagnostics.push("Kairo must consume the KairoAPIClient product");
  }

  for (const [name, target] of Object.entries(project.targets ?? {})) {
    if (name === "Kairo") {
      continue;
    }
    const consumesClient = target.dependencies?.some(
      (dependency) =>
        typeof dependency === "object" &&
        (dependency.package === "KairoAPIClient" ||
          dependency.product === "KairoAPIClient"),
    );
    if (consumesClient) {
      diagnostics.push(`${name} must not consume KairoAPIClient`);
    }
  }

  return diagnostics;
}

function readPackageDump(): PackageDump {
  const result = spawnSync(
    "swift",
    ["package", "dump-package", "--package-path", "ios/Kairo"],
    { cwd: resolve("."), encoding: "utf8" },
  );
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout);
  }
  return JSON.parse(result.stdout) as PackageDump;
}

const packageReadme = readFileSync(resolve("ios/Kairo/README.md"), "utf8");
const project = parseYaml(
  readFileSync(resolve("ios/project.yml"), "utf8"),
) as Project;
const packageTestFiles = readSwiftFiles("ios/Kairo/Tests/KairoTests");
const appUnitTestFiles = readSwiftFiles("ios/UnitTests");

afterEach(() => {
  for (const directory of tempDirs.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("generated iOS client adoption", () => {
  it("validates the package product and target semantically", () => {
    expect(validatePackageDump(readPackageDump())).toEqual([]);
  });

  it("rejects a source path borrowed from a different package target", () => {
    const malformedDump: PackageDump = {
      products: [
        {
          name: "KairoAPIClient",
          targets: ["KairoAPIClient"],
          type: { library: ["automatic"] },
        },
      ],
      targets: [
        {
          name: "KairoAPIClient",
          type: "regular",
          pluginUsages: [
            { plugin: ["OpenAPIGenerator", "swift-openapi-generator"] },
          ],
        },
        {
          name: "BorrowedPath",
          type: "regular",
          path: "Sources/Kairo",
        },
        {
          name: "KairoTests",
          type: "test",
          dependencies: [{ byName: ["KairoAPIClient", null] }],
        },
      ],
    };

    expect(validatePackageDump(malformedDump)).toContain(
      "KairoAPIClient target path must be Sources/Kairo",
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

  it("finds wrong module imports in nested Swift test directories", () => {
    const directory = mkdtempSync(join(tmpdir(), "kairo-nested-tests-"));
    tempDirs.push(directory);
    mkdirSync(join(directory, "Nested"));
    writeFileSync(
      join(directory, "Nested", "WrongModuleTests.swift"),
      "import XCTest\n@testable import KairoAPIClient\n",
    );

    expect(validateTestableImports(readSwiftFiles(directory), "Kairo")).toEqual([
      "Nested/WrongModuleTests.swift must @testable import Kairo exactly once; found KairoAPIClient",
    ]);
  });

  it("documents the current Swift package test count", () => {
    expect(packageReadme).toContain("45 tests across 7 suites.");
    expect(packageReadme).not.toContain("44 tests across 8 suites.");
    expect(packageReadme).not.toContain("40 tests across 8 suites.");
  });

  it("links the local client product only to the shipping application", () => {
    expect(validateProjectPackageUsage(project)).toEqual([]);
  });

  it("allows unrelated local packages in the generated project", () => {
    expect(
      validateProjectPackageUsage({
        ...project,
        packages: {
          ...project.packages,
          UnrelatedPackage: { path: "Unrelated" },
        },
      }),
    ).toEqual([]);
  });

  it("rejects generated-client consumption by a non-app target", () => {
    const invalidProject: Project = {
      ...project,
      targets: {
        ...project.targets,
        KairoWidget: {
          ...project.targets?.KairoWidget,
          type: "app-extension",
          dependencies: [
            ...(project.targets?.KairoWidget?.dependencies ?? []),
            {
              package: "KairoAPIClient",
              product: "KairoAPIClient",
            },
          ],
        },
      },
    };

    expect(validateProjectPackageUsage(invalidProject)).toContain(
      "KairoWidget must not consume KairoAPIClient",
    );
  });
});
