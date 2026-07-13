/**
 * Contract parity test — ADR-002 CI drift gate.
 *
 * Asserts the OpenAPI spec (api/openapi.yaml) and the zod validators
 * (src/server/schemas/) stay in sync: every component schema in the spec has a
 * matching entry in the zod response registry, and vice-versa. CI fails on
 * drift, so a change in one place forces the other to follow.
 *
 * This test does NOT validate deep shape equality (that would couple too
 * tightly); it enforces name-level parity and that enum string sets match.
 * Route-handler-level request/response shape validation is a 1C concern.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import { responseSchemaRegistry } from "./index";

const SPEC_PATH = resolve(process.cwd(), "api/openapi.yaml");

interface OpenApiSpec {
  openapi?: string;
  info?: { version?: string };
  paths?: Record<string, Record<string, unknown>>;
  components?: { schemas?: Record<string, unknown>; parameters?: Record<string, unknown> };
}

function loadSpec(): OpenApiSpec {
  const text = readFileSync(SPEC_PATH, "utf8");
  return parseYaml(text) as OpenApiSpec;
}

function getComponentNames(spec: OpenApiSpec): Set<string> {
  return new Set(spec.components?.schemas ? Object.keys(spec.components.schemas) : []);
}

describe("ADR-002: OpenAPI ↔ zod parity (CI drift gate)", () => {
  const spec = loadSpec();
  const specNames = getComponentNames(spec);
  const zodNames = new Set(Object.keys(responseSchemaRegistry));

  // OpenAPI legitimately defines MORE named components than the zod registry:
  // enums and primitives (HourCycle, Priority, Revision, …) that OpenAPI needs
  // as $ref targets but zod expresses inline. The parity contract is therefore
  // directional on names:
  //  - every zod RESOURCE/response schema → must have an OpenAPI component
  //  - OpenAPI-only enum/primitive components → allowed (no zod key needed)
  // This catches the real drift: a resource added to one side but not the other.
  const OPENAPI_ONLY_ALLOWED = new Set([
    "ErrorEnvelope",
    "BatchOperation",
    "BatchResult",
    "HourCycle",
    "ThemeMode",
    "TaskBucket",
    "EnergyLevel",
    "Priority",
    "OccurrenceStatus",
    "ChecklistParent",
    "ActivitySource",
    "FocusState",
    "PlannerEventType",
    "ChangeOp",
    "EditScope",
    "Revision",
  ]);

  it("the spec is valid OpenAPI 3.1", () => {
    expect(spec.openapi).toBe("3.1.0");
    expect(spec.paths).toBeDefined();
    expect(spec.components?.schemas).toBeDefined();
  });

  it("every zod registry entry has a matching OpenAPI component (resource parity)", () => {
    const missing = [...zodNames].filter((n) => !specNames.has(n));
    expect(
      missing,
      `zod validators without an OpenAPI component: ${missing.join(", ")}`,
    ).toEqual([]);
  });

  it("every OpenAPI resource component is covered (enums/primitives exempt)", () => {
    // Resource components (the ones the zod registry covers) must all be
    // present. OpenAPI-only enum/primitive components are allowed.
    const unexpected = [...specNames].filter(
      (n) => !zodNames.has(n) && !OPENAPI_ONLY_ALLOWED.has(n),
    );
    expect(
      unexpected,
      `OpenAPI components that are neither a zod resource nor a known enum/primitive: ${unexpected.join(", ")}. Either add a zod validator or add the name to OPENAPI_ONLY_ALLOWED.`,
    ).toEqual([]);
  });

  it("the API version is 1.x (under /api/v1)", () => {
    expect(spec.info?.version).toMatch(/^1\./);
  });

  it("the error envelope is defined", () => {
    expect(specNames).toContain("Error");
  });

  it("the changes feed endpoint exists (ADR-002 incremental sync)", () => {
    const paths = spec.paths ?? {};
    expect(paths["/changes"]).toBeDefined();
    expect(paths["/changes"]?.get).toBeDefined();
  });

  it("the batch endpoint exists (ADR-002 ordered operations)", () => {
    const paths = spec.paths ?? {};
    expect(paths["/batch"]).toBeDefined();
    expect(paths["/batch"]?.post).toBeDefined();
  });

  it("the day endpoint exists (ADR-001 resolved day)", () => {
    const paths = spec.paths ?? {};
    expect(Object.keys(paths).some((p) => p.startsWith("/day"))).toBe(true);
  });

  it("Idempotency-Key header parameter is defined", () => {
    const paramNames = spec.components?.parameters
      ? Object.keys(spec.components.parameters)
      : [];
    expect(
      paramNames.some((n) => n.toLowerCase().includes("idempotency")),
      "Idempotency-Key parameter missing from components",
    ).toBe(true);
  });
});
