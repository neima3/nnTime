import { afterEach, describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import {
  chmodSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

import { installPackageLock } from "../scripts/ios-package-lock.mjs";

const tempDirs: string[] = [];
const authoritativeLockPath = resolve("ios/Kairo/Package.resolved");
const nativeEntryPoints = [
  "scripts/ios-main-thread-gate.sh",
  "scripts/ios-device-install.sh",
  "scripts/ios-release.sh",
];

afterEach(() => {
  for (const directory of tempDirs.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("iOS native package toolchain", () => {
  it("keeps an authoritative exact Swift package graph under version control", () => {
    const ignoreRules = [".gitignore", "ios/Kairo/.gitignore"].flatMap((file) =>
      readFileSync(resolve(file), "utf8")
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean),
    );
    const lock = JSON.parse(readFileSync(authoritativeLockPath, "utf8")) as {
      pins?: Array<{
        identity?: string;
        state?: { revision?: string; version?: string };
      }>;
      version?: number;
    };

    expect(ignoreRules).not.toContain("Package.resolved");
    expect(ignoreRules).not.toContain("ios/Kairo/Package.resolved");
    expect(lock.version).toBe(3);
    expect(lock.pins?.length).toBeGreaterThan(0);
    expect(lock.pins?.map((pin) => pin.identity)).toEqual(
      expect.arrayContaining([
        "swift-openapi-generator",
        "swift-openapi-runtime",
        "swift-openapi-urlsession",
      ]),
    );
    for (const pin of lock.pins ?? []) {
      expect(pin.state?.revision, pin.identity).toMatch(/^[0-9a-f]{40}$/);
      expect(pin.state?.version, pin.identity).toMatch(/^\d+\.\d+\.\d+/);
    }
  });

  it("replaces generated-project lock drift byte-for-byte", () => {
    const directory = mkdtempSync(join(tmpdir(), "kairo-lock-"));
    tempDirs.push(directory);
    const generatedLockPath = join(
      directory,
      "Kairo.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved",
    );
    mkdirSync(resolve(generatedLockPath, ".."), { recursive: true });
    writeFileSync(generatedLockPath, '{"pins":[]}\n');

    expect(
      installPackageLock(authoritativeLockPath, generatedLockPath),
    ).toBe("updated");
    expect(readFileSync(generatedLockPath)).toEqual(
      readFileSync(authoritativeLockPath),
    );
    expect(
      installPackageLock(authoritativeLockPath, generatedLockPath),
    ).toBe("unchanged");
  });

  it("injects the locked-plugin policy into every wrapped xcodebuild", () => {
    const directory = mkdtempSync(join(tmpdir(), "kairo-xcodebuild-"));
    tempDirs.push(directory);
    const fakeXcodebuild = join(directory, "xcodebuild");
    writeFileSync(fakeXcodebuild, "#!/usr/bin/env bash\nprintf '%s\\n' \"$@\"\n");
    chmodSync(fakeXcodebuild, 0o755);

    const output = execFileSync(
      "bash",
      [
        resolve("scripts/ios-xcodebuild.sh"),
        "archive",
        "-project",
        "Kairo.xcodeproj",
      ],
      {
        encoding: "utf8",
        env: { ...process.env, PATH: `${directory}:${process.env.PATH}` },
      },
    );

    expect(output.trim().split("\n")).toEqual([
      "-skipPackagePluginValidation",
      "-onlyUsePackageVersionsFromResolvedFile",
      "archive",
      "-project",
      "Kairo.xcodeproj",
    ]);
  });

  it("routes every native script through deterministic preparation and build wrappers", () => {
    for (const file of nativeEntryPoints) {
      const source = readFileSync(resolve(file), "utf8");
      expect(source, file).toContain("ios-prepare-project.sh");
      expect(source, file).toContain("ios-xcodebuild.sh");
      expect(source, file).not.toMatch(/^\s*xcodegen\s+generate\b/m);
      expect(source, file).not.toMatch(/^\s*xcodebuild(?:\s|$)/m);
    }

    const preparation = readFileSync(
      resolve("scripts/ios-prepare-project.sh"),
      "utf8",
    );
    expect(preparation).toContain("ios-package-lock.mjs");
    expect(preparation).toContain("ios/Kairo/Package.resolved");
  });

  it("documents deterministic preparation and both noninteractive Xcode flags", () => {
    const readme = readFileSync(resolve("ios/README.md"), "utf8");
    expect(readme).toContain("./scripts/ios-prepare-project.sh");
    expect(readme.match(/-skipPackagePluginValidation/g)).toHaveLength(2);
    expect(
      readme.match(/-onlyUsePackageVersionsFromResolvedFile/g),
    ).toHaveLength(2);
    expect(readme).toContain("security risk");
    expect(readme).toContain("committed");

    const packageReadme = readFileSync(
      resolve("ios/Kairo/README.md"),
      "utf8",
    );
    expect(packageReadme).toContain("Package.resolved");
    expect(packageReadme).toContain("ios-prepare-project.sh");
  });
});
