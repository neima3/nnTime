import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse as parseYaml } from "yaml";

interface WorkflowStep {
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

  it("checks both OpenAPI drift surfaces before Swift compilation", () => {
    const steps = workflow.jobs?.["native-contract"]?.steps ?? [];
    const commands = steps.map((step) => step.run ?? "").join("\n");
    const lockedSwiftTest =
      "swift test --package-path ios/Kairo --only-use-versions-from-resolved-file";

    expect(commands).toContain("pnpm install --frozen-lockfile");
    expect(commands).toContain("pnpm api:check-ios");
    expect(commands).toContain("pnpm api:check-ios-client");
    expect(
      steps.find((step) => step.run?.startsWith("swift test"))?.run,
    ).toBe(lockedSwiftTest);
    expect(commands).not.toMatch(
      /(?:^|\n)\s*swift test --package-path ios\/Kairo\s*(?:\n|$)/,
    );
    expect(commands.indexOf("pnpm api:check-ios")).toBeLessThan(
      commands.indexOf(lockedSwiftTest),
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
});
