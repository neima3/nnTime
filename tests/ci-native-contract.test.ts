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

    expect(commands).toContain("pnpm install --frozen-lockfile");
    expect(commands).toContain("pnpm api:check-ios");
    expect(commands).toContain("pnpm api:check-ios-client");
    expect(commands).toContain("swift test --package-path ios/Kairo");
    expect(commands.indexOf("pnpm api:check-ios")).toBeLessThan(
      commands.indexOf("swift test --package-path ios/Kairo"),
    );
  });
});
