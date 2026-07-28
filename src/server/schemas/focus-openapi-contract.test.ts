import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse as parseYaml } from "yaml";

interface Operation {
  operationId?: string;
  requestBody?: {
    content?: {
      "application/json"?: { schema?: { $ref?: string } };
    };
  };
  responses?: Record<
    string,
    {
      content?: {
        "application/json"?: { schema?: { $ref?: string } };
      };
    }
  >;
}

interface Spec {
  paths?: Record<
    string,
    { get?: Operation; post?: Operation; patch?: Operation }
  >;
  components?: {
    schemas?: Record<
      string,
      { properties?: Record<string, { type?: string; format?: string }> }
    >;
  };
}

const spec = parseYaml(
  readFileSync(resolve("api/openapi.yaml"), "utf8"),
) as Spec;

function responseRef(operation: Operation | undefined, status: string) {
  return operation?.responses?.[status]?.content?.["application/json"]?.schema
    ?.$ref;
}

describe("focus OpenAPI contract", () => {
  it("documents the active snapshot read used by iOS", () => {
    const operation = spec.paths?.["/focus-sessions"]?.get;

    expect(operation?.operationId).toBe("getActiveFocusSession");
    expect(responseRef(operation, "200")).toBe(
      "#/components/schemas/FocusSnapshot",
    );
  });

  it("documents start and patch request/response wire shapes", () => {
    const start = spec.paths?.["/focus-sessions"]?.post;
    const patch = spec.paths?.["/focus-sessions/{id}"]?.patch;

    expect(
      start?.requestBody?.content?.["application/json"]?.schema?.$ref,
    ).toBe("#/components/schemas/FocusSessionCreateRequest");
    expect(responseRef(start, "201")).toBe(
      "#/components/schemas/FocusSnapshot",
    );
    expect(
      patch?.requestBody?.content?.["application/json"]?.schema?.$ref,
    ).toBe("#/components/schemas/FocusSessionPatchRequest");
    expect(responseRef(patch, "200")).toBe(
      "#/components/schemas/FocusSnapshot",
    );
  });

  it("defines the registered focus request and snapshot components", () => {
    expect(spec.components?.schemas?.FocusSessionCreateRequest).toBeDefined();
    expect(spec.components?.schemas?.FocusSessionPatchRequest).toBeDefined();
    expect(spec.components?.schemas?.FocusSnapshot).toBeDefined();
    expect(
      spec.components?.schemas?.FocusSession?.properties?.userId,
    ).toEqual({ type: "string" });
  });
});
