import { execFileSync, spawnSync } from "node:child_process";
import { rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const script = resolve("scripts/ios-release.sh");
const redactor = resolve("scripts/ios-release-redact.mjs");
const baseEnvironment = {
  ...process.env,
  KAIRO_RELEASE_DRY_RUN: "1",
  KAIRO_ALLOW_DIRTY: "1",
  KAIRO_BUILD_NUMBER: "314",
};

function run(mode: string) {
  return execFileSync("bash", [script, mode], {
    cwd: resolve("."),
    encoding: "utf8",
    env: baseEnvironment,
  });
}

describe("iOS release driver", () => {
  it("plans a deterministic signed archive with provenance", () => {
    const output = run("archive");

    expect(output).toContain("Build number: 314");
    expect(output).toContain("xcodebuild archive");
    expect(output).toContain("generic/platform=iOS");
    expect(output).toContain("KAIRO_BUILD_NUMBER=314");
    expect(output).toContain("KAIRO_GIT_SHA=");
    expect(output).toContain("KAIRO_BUILD_DATE=");
    expect(output).toContain("Kairo.xcarchive");
  });

  it("keeps export and upload destinations explicit", () => {
    const exportOutput = run("export");
    const uploadOutput = run("upload");

    expect(exportOutput).toContain("<string>export</string>");
    expect(uploadOutput).toContain("<string>upload</string>");
    expect(exportOutput).toContain("<string>app-store-connect</string>");
    expect(uploadOutput).toContain("<string>app-store-connect</string>");
    expect(exportOutput).toContain("<key>manageAppVersionAndBuildNumber</key>");
    expect(exportOutput).toContain("<false/>");
  });

  it("does not echo App Store Connect credential values", () => {
    const output = execFileSync("bash", [script, "upload"], {
      cwd: resolve("."),
      encoding: "utf8",
      env: {
        ...baseEnvironment,
        KAIRO_ASC_KEY_ID: "SECRET_KEY_ID",
        KAIRO_ASC_ISSUER_ID: "SECRET_ISSUER_ID",
        KAIRO_ASC_KEY_PATH: "/secret/AuthKey.p8",
      },
    });

    expect(output).not.toContain("SECRET_KEY_ID");
    expect(output).not.toContain("SECRET_ISSUER_ID");
    expect(output).not.toContain("/secret/AuthKey.p8");
  });

  it("redacts credentials from real command output before it reaches logs", () => {
    const result = spawnSync("node", [redactor], {
      cwd: resolve("."),
      encoding: "utf8",
      input:
        "xcodebuild -authenticationKeyID SECRET_KEY_ID -authenticationKeyIssuerID SECRET_ISSUER_ID -authenticationKeyPath /secret/AuthKey_SECRET_KEY_ID.p8\n",
      env: {
        ...process.env,
        KAIRO_ASC_KEY_ID: "SECRET_KEY_ID",
        KAIRO_ASC_ISSUER_ID: "SECRET_ISSUER_ID",
        KAIRO_ASC_KEY_PATH: "/secret/AuthKey_SECRET_KEY_ID.p8",
      },
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("<redacted>");
    expect(result.stdout).not.toContain("SECRET_KEY_ID");
    expect(result.stdout).not.toContain("SECRET_ISSUER_ID");
    expect(result.stdout).not.toContain("/secret/");
    expect(result.stdout).not.toContain("AuthKey_");
  });

  it("never permits the dirty-tree override for a real release", () => {
    const marker = resolve(`.kairo-release-dirty-test-${process.pid}`);
    writeFileSync(marker, "release provenance test\n");
    try {
      const result = spawnSync("bash", [script, "preflight"], {
        cwd: resolve("."),
        encoding: "utf8",
        env: {
          ...process.env,
          KAIRO_RELEASE_DRY_RUN: "0",
          KAIRO_ALLOW_DIRTY: "1",
          KAIRO_BUILD_NUMBER: "314",
        },
      });

      expect(result.status).toBe(67);
      expect(result.stderr).toContain("Release checkout must be clean");
    } finally {
      rmSync(marker, { force: true });
    }
  });

  it("rejects unknown modes", () => {
    const result = spawnSync("bash", [script, "launch"], {
      cwd: resolve("."),
      encoding: "utf8",
      env: baseEnvironment,
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(
      "Usage: scripts/ios-release.sh preflight|archive|export|upload",
    );
  });
});
