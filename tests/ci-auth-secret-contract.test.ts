import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parse as parseYaml } from "yaml";

interface WorkflowJob {
  env?: Record<string, unknown>;
}

interface Workflow {
  jobs?: Record<string, WorkflowJob>;
}

const workflow = parseYaml(
  readFileSync(resolve(".github/workflows/ci.yml"), "utf8"),
) as Workflow;

describe("CI Better Auth secret contract", () => {
  it("uses one explicit high-entropy CI-only value in every auth runtime", () => {
    const jobNames = ["build-test", "e2e"];
    const secrets = jobNames.map((jobName) => {
      const value = workflow.jobs?.[jobName]?.env?.BETTER_AUTH_SECRET;

      expect(value, `${jobName} BETTER_AUTH_SECRET`).toBeTypeOf("string");
      return String(value);
    });

    expect(new Set(secrets)).toHaveLength(1);
    const [secret] = secrets;
    expect(secret).toMatch(/^ci-only-/);
    expect(secret.length).toBeGreaterThanOrEqual(32);
    expect(new Set(secret).size).toBeGreaterThanOrEqual(16);
    expect(secret).toMatch(/[a-z]/);
    expect(secret).toMatch(/[A-Z]/);
    expect(secret).toMatch(/[0-9]/);
    expect(secret).not.toContain("${{");
  });
});
