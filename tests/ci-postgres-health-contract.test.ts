import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parse as parseYaml } from "yaml";

interface PostgresService {
  env?: Record<string, unknown>;
  image?: string;
  options?: string;
  ports?: string[];
}

interface Workflow {
  jobs?: Record<
    string,
    {
      env?: Record<string, unknown>;
      services?: { postgres?: PostgresService };
    }
  >;
}

const workflow = parseYaml(
  readFileSync(resolve(".github/workflows/ci.yml"), "utf8"),
) as Workflow;

describe("CI Postgres health probes", () => {
  it.each([
    ["build-test", "kairo_test"],
    ["e2e", "kairo_e2e"],
  ])("probes the database created for %s", (jobName, databaseName) => {
    const service = workflow.jobs?.[jobName]?.services?.postgres;
    const options = service?.options ?? "";

    expect(service?.image).toBe("postgres:17-alpine");
    expect(service?.env?.POSTGRES_USER).toBe("kairo");
    expect(service?.env?.POSTGRES_PASSWORD).toBe("kairo");
    expect(service?.env?.POSTGRES_DB).toBe(databaseName);
    expect(workflow.jobs?.[jobName]?.env?.DATABASE_URL).toBe(
      `postgresql://kairo:kairo@localhost:5432/${databaseName}`,
    );
    expect(service?.ports).toEqual(["5432:5432"]);
    expect(options).toContain(
      `--health-cmd "pg_isready -U kairo -d ${databaseName}"`,
    );
    expect(options).toContain("--health-interval 5s");
    expect(options).toContain("--health-timeout 5s");
    expect(options).toContain("--health-retries 10");
  });
});
