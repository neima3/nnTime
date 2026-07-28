import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse as parseYaml } from "yaml";

interface WorkflowStep {
  name?: string;
  uses?: string;
  run?: string;
}

interface Workflow {
  jobs?: Record<
    string,
    {
      "runs-on"?: string;
      steps?: WorkflowStep[];
    }
  >;
}

const workflow = parseYaml(
  readFileSync(resolve(".github/workflows/ci.yml"), "utf8"),
) as Workflow;

describe("native API contract CI", () => {
  it("runs the native contract on a macOS worker", () => {
    const job = workflow.jobs?.["native-contract"];

    expect(job?.["runs-on"]).toMatch(/^macos-/);
    expect(job?.steps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ uses: "actions/checkout@v4" }),
        expect.objectContaining({ uses: "pnpm/action-setup@v4" }),
        expect.objectContaining({ uses: "actions/setup-node@v4" }),
      ]),
    );
  });

  it("checks canonical sync and generated-client adoption before Swift compilation", () => {
    const steps = workflow.jobs?.["native-contract"]?.steps ?? [];
    const commands = steps.map((step) => step.run ?? "").join("\n");
    const lockedSwiftTest =
      "swift test --package-path ios/Kairo --only-use-versions-from-resolved-file";

    expect(commands).toContain("pnpm install --frozen-lockfile");
    expect(commands).toContain("pnpm api:check-ios");
    expect(commands).toContain("pnpm api:check-ios-adoption");
    expect(commands).toContain(
      "swift package clean --package-path ios/Kairo",
    );
    expect(commands).toContain(lockedSwiftTest);
    expect(commands).not.toMatch(
      /(?:^|\n)\s*swift test --package-path ios\/Kairo\s*(?:\n|$)/,
    );
    expect(
      commands.indexOf("swift package clean --package-path ios/Kairo"),
    ).toBeLessThan(commands.indexOf(lockedSwiftTest));
    expect(commands.indexOf("pnpm api:check-ios")).toBeLessThan(
      commands.indexOf(lockedSwiftTest),
    );
    expect(commands.indexOf("pnpm api:check-ios-adoption")).toBeLessThan(
      commands.indexOf(lockedSwiftTest),
    );
  });

  it("prepares, tests, and unsigned-builds the shipping app on a selected simulator", () => {
    const steps = workflow.jobs?.["native-contract"]?.steps ?? [];
    const commands = steps.map((step) => step.run ?? "").join("\n");
    const unitTestCommand =
      steps.find((step) => step.name === "Test shipping application")?.run ??
      "";
    const appBuildCommand =
      steps.find(
        (step) => step.name === "Build unsigned shipping application",
      )?.run ?? "";
    const mainThreadGate = readFileSync(
      resolve("scripts/ios-main-thread-gate.sh"),
      "utf8",
    );
    const prepareScript = readFileSync(
      resolve("scripts/ios-prepare-project.sh"),
      "utf8",
    );

    expect(commands).toContain("xcrun simctl list devices available -j");
    expect(commands).toContain("xcrun simctl bootstatus");
    expect(commands).toContain("KAIRO_SIMULATOR_ID");
    expect(commands).toContain("./scripts/ios-prepare-project.sh");
    expect(prepareScript).toContain("xcodegen generate --spec ios/project.yml");
    expect(unitTestCommand).toContain("./scripts/ios-main-thread-gate.sh");
    expect(mainThreadGate).toContain("-only-testing:KairoUnitTests");
    expect(mainThreadGate).toContain(
      '-destination "platform=iOS Simulator,id=$SIMULATOR_ID"',
    );
    expect(appBuildCommand).toContain("./scripts/ios-xcodebuild.sh");
    expect(appBuildCommand).toContain("-project ios/Kairo.xcodeproj");
    expect(appBuildCommand).toContain("-scheme Kairo");
    expect(appBuildCommand).toContain(
      '-destination "platform=iOS Simulator,id=$KAIRO_SIMULATOR_ID"',
    );
    expect(appBuildCommand).toContain("CODE_SIGNING_ALLOWED=NO");
    expect(appBuildCommand).toMatch(/(?:^|\n)\s*build\s*(?:\\)?$/m);
    expect(commands).not.toMatch(
      /-destination ['"]platform=iOS Simulator,name=/,
    );

    const prepareIndex = steps.findIndex(
      (step) => step.name === "Prepare shipping Xcode project",
    );
    const toolingIndex = steps.findIndex(
      (step) => step.name === "Install Apple release tooling",
    );
    const testIndex = steps.findIndex(
      (step) => step.name === "Test shipping application",
    );
    const buildIndex = steps.findIndex(
      (step) => step.name === "Build unsigned shipping application",
    );
    expect(prepareIndex).toBeGreaterThanOrEqual(0);
    expect(toolingIndex).toBeGreaterThanOrEqual(0);
    expect(toolingIndex).toBeLessThan(prepareIndex);
    expect(prepareIndex).toBeLessThan(testIndex);
    expect(prepareIndex).toBeLessThan(buildIndex);
  });

  it("executes the simulator selector against simctl JSON without shell quoting drift", () => {
    const selector =
      workflow.jobs?.["native-contract"]?.steps?.find(
        (step) => step.name === "Select available iPhone simulator",
      )?.run ?? "";
    const python = selector.match(/python3 -c '([\s\S]*?)'\s*\n\s*\)/)?.[1];
    expect(python).toBeTruthy();
    if (!python) return;

    const result = spawnSync("python3", ["-c", python], {
      encoding: "utf8",
      input: JSON.stringify({
        devices: {
          "com.apple.CoreSimulator.SimRuntime.iOS-99-0": [
            {
              name: "iPhone CI",
              udid: "00000000-0000-0000-0000-000000000001",
              state: "Shutdown",
            },
          ],
        },
      }),
    });

    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe(
      "00000000-0000-0000-0000-000000000001|Shutdown",
    );
  });

  it("runs Apple-tooling release tests on macOS instead of Linux", () => {
    const linuxCommands = (
      workflow.jobs?.["build-test"]?.steps ?? []
    ).map((step) => step.run ?? "").join("\n");
    const macCommands = (
      workflow.jobs?.["native-contract"]?.steps ?? []
    ).map((step) => step.run ?? "").join("\n");

    expect(linuxCommands).toContain(
      "--exclude tests/ios-release-contract.test.ts",
    );
    expect(linuxCommands).toContain(
      "--exclude tests/ios-release-script.test.ts",
    );
    expect(macCommands).toContain(
      "tests/ios-release-contract.test.ts tests/ios-release-script.test.ts",
    );
    expect(macCommands).toContain("brew install xcodegen");
    expect(macCommands.indexOf("brew install xcodegen")).toBeLessThan(
      macCommands.indexOf("tests/ios-release-contract.test.ts"),
    );
  });

  it("does not weaken Linux web or browser jobs", () => {
    const webSteps = workflow.jobs?.["build-test"]?.steps ?? [];
    const webCommands = webSteps.map((step) => step.run ?? "").join("\n");
    const e2eCommands = (
      workflow.jobs?.e2e?.steps ?? []
    ).map((step) => step.run ?? "").join("\n");
    const webTestCommand =
      webSteps.find((step) => step.name?.startsWith("Test ("))?.run ?? "";
    const exclusions = Array.from(
      webTestCommand.matchAll(/--exclude\s+(\S+)/g),
      (match) => match[1],
    );

    expect(webCommands).toContain("pnpm lint");
    expect(webCommands).toContain("pnpm typecheck");
    expect(webCommands).toContain("pnpm exec vitest run");
    expect(webCommands).toContain("pnpm build");
    expect(exclusions).toEqual([
      "tests/ios-release-contract.test.ts",
      "tests/ios-release-script.test.ts",
    ]);
    expect(e2eCommands).toContain("pnpm exec playwright install --with-deps chromium");
    expect(e2eCommands).toContain("pnpm build");
    expect(e2eCommands).toContain("pnpm test:e2e");
    expect(e2eCommands).not.toContain("--exclude");
  });
});
