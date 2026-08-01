import { afterEach, describe, expect, it } from "vitest";
import { execFileSync, spawnSync } from "node:child_process";
import {
  chmodSync,
  lstatSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
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
  it("uses a portable explicit template for the wrapped xcodebuild log", () => {
    const source = readFileSync(resolve("scripts/ios-xcodebuild.sh"), "utf8");

    expect(source).toContain(
      'mktemp "${TMPDIR:-/tmp}/kairo-xcodebuild.XXXXXX"',
    );
  });

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

  it("atomically replaces generated-project lock drift byte-for-byte", () => {
    const directory = mkdtempSync(join(tmpdir(), "kairo-lock-"));
    tempDirs.push(directory);
    const externalLockPath = join(directory, "external-lock");
    const generatedLockPath = join(
      directory,
      "Kairo.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved",
    );
    const generatedLockDirectory = resolve(generatedLockPath, "..");
    mkdirSync(generatedLockDirectory, { recursive: true });
    writeFileSync(externalLockPath, "external sentinel\n");
    symlinkSync(externalLockPath, generatedLockPath);

    expect(
      installPackageLock(authoritativeLockPath, generatedLockPath),
    ).toBe("updated");
    expect(readFileSync(generatedLockPath)).toEqual(
      readFileSync(authoritativeLockPath),
    );
    expect(readFileSync(externalLockPath, "utf8")).toBe("external sentinel\n");
    expect(lstatSync(generatedLockPath).isSymbolicLink()).toBe(false);
    expect(readdirSync(generatedLockDirectory)).toEqual(["Package.resolved"]);
  });

  it("does not rewrite an unchanged generated-project lock", () => {
    const directory = mkdtempSync(join(tmpdir(), "kairo-lock-"));
    tempDirs.push(directory);
    const generatedLockPath = join(directory, "Package.resolved");
    writeFileSync(generatedLockPath, readFileSync(authoritativeLockPath));

    expect(
      installPackageLock(authoritativeLockPath, generatedLockPath),
    ).toBe("unchanged");
    expect(readdirSync(directory)).toEqual(["Package.resolved"]);
  });

  it("leaves the existing destination untouched when the source lock is invalid", () => {
    const directory = mkdtempSync(join(tmpdir(), "kairo-lock-"));
    tempDirs.push(directory);
    const invalidLockPath = join(directory, "invalid.json");
    const generatedLockDirectory = join(directory, "generated");
    const generatedLockPath = join(generatedLockDirectory, "Package.resolved");
    mkdirSync(generatedLockDirectory);
    writeFileSync(invalidLockPath, '{"pins":');
    writeFileSync(generatedLockPath, "existing destination\n");

    expect(() =>
      installPackageLock(invalidLockPath, generatedLockPath),
    ).toThrow("is not valid JSON");
    expect(readFileSync(generatedLockPath, "utf8")).toBe(
      "existing destination\n",
    );
    expect(readdirSync(generatedLockDirectory)).toEqual(["Package.resolved"]);
  });

  it("cleans up its same-directory temporary file when replacement fails", () => {
    const directory = mkdtempSync(join(tmpdir(), "kairo-lock-"));
    tempDirs.push(directory);
    const generatedLockPath = join(directory, "Package.resolved");
    mkdirSync(generatedLockPath);

    expect(() =>
      installPackageLock(authoritativeLockPath, generatedLockPath),
    ).toThrow();
    expect(readdirSync(directory)).toEqual(["Package.resolved"]);
  });

  it("uses a unique same-directory rename instead of writing the destination directly", () => {
    const source = readFileSync(
      resolve("scripts/ios-package-lock.mjs"),
      "utf8",
    );

    expect(source).toContain("randomUUID");
    expect(source).toContain("renameSync");
    expect(source).toContain("unlinkSync");
    expect(source).toMatch(/join\(\s*dirname\(destinationPath\)/);
    expect(source).not.toMatch(/writeFileSync\(\s*destinationPath/);
  });

  it("injects the locked-plugin policy into every wrapped xcodebuild", () => {
    const directory = mkdtempSync(join(tmpdir(), "kairo-xcodebuild-"));
    tempDirs.push(directory);
    const fakeXcodebuild = join(directory, "xcodebuild");
    writeFileSync(fakeXcodebuild, "#!/usr/bin/env bash\nprintf '%s\\n' \"$@\"\n");
    chmodSync(fakeXcodebuild, 0o755);

    const countWrapperLogs = () =>
      readdirSync(tmpdir()).filter((file) => file.startsWith("kairo-xcodebuild."))
        .length;
    const logCountBefore = countWrapperLogs();
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
    expect(countWrapperLogs()).toBe(logCountBefore);
  });

  it("fails every wrapped xcodebuild on a Kairo Swift source warning", () => {
    const directory = mkdtempSync(join(tmpdir(), "kairo-xcodebuild-warning-"));
    tempDirs.push(directory);
    const fakeXcodebuild = join(directory, "xcodebuild");
    const warningPath = resolve("ios/Shared/DayCache.swift");
    writeFileSync(
      fakeXcodebuild,
      `#!/usr/bin/env bash\nprintf '%s:29:9: warning: fixture warning\\n' '${warningPath}'\n`,
    );
    chmodSync(fakeXcodebuild, 0o755);

    const result = spawnSync(
      "bash",
      [resolve("scripts/ios-xcodebuild.sh"), "build"],
      {
        encoding: "utf8",
        env: { ...process.env, PATH: `${directory}:${process.env.PATH}` },
      },
    );

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("fixture warning");
    expect(result.stderr).toContain("Kairo Swift source warning");
  });

  it("fails closed when wrapped xcodebuild output cannot be captured", () => {
    const directory = mkdtempSync(join(tmpdir(), "kairo-xcodebuild-tee-"));
    tempDirs.push(directory);
    const fakeXcodebuild = join(directory, "xcodebuild");
    const fakeTee = join(directory, "tee");
    writeFileSync(fakeXcodebuild, "#!/usr/bin/env bash\nprintf 'clean build\\n'\n");
    writeFileSync(fakeTee, "#!/usr/bin/env bash\nexit 23\n");
    chmodSync(fakeXcodebuild, 0o755);
    chmodSync(fakeTee, 0o755);

    const result = spawnSync(
      "bash",
      [resolve("scripts/ios-xcodebuild.sh"), "build"],
      {
        encoding: "utf8",
        env: { ...process.env, PATH: `${directory}:${process.env.PATH}` },
      },
    );

    expect(result.status).toBe(23);
    expect(result.stderr).toContain("Unable to capture xcodebuild output");
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
    expect(readme.match(/\.\/scripts\/ios-xcodebuild\.sh/g)).toHaveLength(2);
    expect(readme).not.toMatch(/^\s*xcodebuild(?:\s|$)/m);
    expect(readme.match(/-skipPackagePluginValidation/g)).toHaveLength(1);
    expect(
      readme.match(/-onlyUsePackageVersionsFromResolvedFile/g),
    ).toHaveLength(1);
    expect(readme).toContain("security risk");
    expect(readme).toContain("committed");

    const packageReadme = readFileSync(
      resolve("ios/Kairo/README.md"),
      "utf8",
    );
    expect(packageReadme).toContain("Package.resolved");
    expect(packageReadme).toContain("ios-prepare-project.sh");
    expect(packageReadme).toContain(
      "swift test --package-path ios/Kairo --only-use-versions-from-resolved-file",
    );
    expect(packageReadme).not.toMatch(
      /^\s*swift test --package-path ios\/Kairo\s*$/m,
    );
  });
});
