import { execFileSync, spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const script = resolve("scripts/ios-release.sh");
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
