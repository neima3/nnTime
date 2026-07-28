import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse as parseYaml } from "yaml";

interface Operation {
  operationId?: string;
  parameters?: Array<{
    name?: string;
    in?: string;
    required?: boolean;
    schema?: Record<string, unknown>;
  }>;
  requestBody?: {
    content?: {
      "application/json"?: { schema?: { $ref?: string } };
    };
  };
  responses?: Record<
    string,
    {
      $ref?: string;
      content?: {
        "application/json"?: { schema?: { $ref?: string } };
      };
    }
  >;
}

interface Spec {
  paths?: Record<string, { get?: Operation; post?: Operation }>;
  components?: {
    schemas?: Record<string, Record<string, unknown>>;
  };
}

const spec = parseYaml(
  readFileSync(resolve("api/openapi.yaml"), "utf8"),
) as Spec;

describe("stats and mood OpenAPI contract", () => {
  it("documents GET /stats with the bounded days query", () => {
    const operation = spec.paths?.["/stats"]?.get;
    const days = operation?.parameters?.find(
      (parameter) => parameter.name === "days",
    );

    expect(operation?.operationId).toBe("getStats");
    expect(days).toMatchObject({
      in: "query",
      required: false,
      schema: {
        type: "integer",
        minimum: 1,
        maximum: 90,
        default: 14,
      },
    });
    expect(
      operation?.responses?.["200"]?.content?.["application/json"]?.schema
        ?.$ref,
    ).toBe("#/components/schemas/StatsResponse");
    expect(operation?.responses?.["400"]?.$ref).toBe(
      "#/components/responses/BadRequest",
    );
    expect(operation?.responses?.["401"]?.$ref).toBe(
      "#/components/responses/Unauthorized",
    );
  });

  it("documents POST /mood with request, 201 response, and errors", () => {
    const operation = spec.paths?.["/mood"]?.post;

    expect(operation?.operationId).toBe("createMoodCheckin");
    expect(
      operation?.requestBody?.content?.["application/json"]?.schema?.$ref,
    ).toBe("#/components/schemas/MoodCheckinRequest");
    expect(
      operation?.responses?.["201"]?.content?.["application/json"]?.schema
        ?.$ref,
    ).toBe("#/components/schemas/MoodCheckinResponse");
    expect(operation?.responses?.["400"]?.$ref).toBe(
      "#/components/responses/BadRequest",
    );
    expect(operation?.responses?.["401"]?.$ref).toBe(
      "#/components/responses/Unauthorized",
    );
  });

  it("defines the registered stats and mood component schemas", () => {
    expect(spec.components?.schemas?.StatsResponse).toMatchObject({
      type: "object",
    });
    expect(spec.components?.schemas?.MoodCheckinRequest).toMatchObject({
      type: "object",
      required: ["mood"],
    });
    expect(spec.components?.schemas?.MoodCheckinResponse).toMatchObject({
      type: "object",
      required: ["ok"],
    });
  });
});
