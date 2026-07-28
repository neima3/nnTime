import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parse as parseYaml } from "yaml";
import { z } from "zod";
import * as schemaIndex from "./index";
import * as routineSchemas from "./routine";

interface JsonSchema {
  $ref?: string;
  anyOf?: JsonSchema[];
  oneOf?: JsonSchema[];
  type?: string | string[];
  required?: string[];
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema;
  maxItems?: number;
}

interface OpenApiOperation {
  operationId?: string;
  requestBody?: {
    content?: {
      "application/json"?: {
        schema?: JsonSchema;
      };
    };
  };
  responses?: Record<
    string,
    {
      content?: {
        "application/json"?: {
          schema?: JsonSchema;
        };
      };
    }
  >;
}

interface OpenApiSpec {
  paths?: Record<string, Record<string, OpenApiOperation>>;
  components?: { schemas?: Record<string, JsonSchema> };
}

const spec = parseYaml(
  readFileSync(resolve("api/openapi.yaml"), "utf8"),
) as OpenApiSpec;
const components = spec.components?.schemas ?? {};

const expectedRequestOperations = {
  createActivitySeries: "ActivitySeriesCreateRequest",
  updateActivitySeries: "ActivitySeriesUpdateRequest",
  overrideActivityOccurrence: "ActivityOccurrencePatchRequest",
  createTask: "TaskCreateRequest",
  updateTask: "TaskUpdateRequest",
  scheduleTask: "ActivitySeriesCreateRequest",
  createChecklistItem: "ChecklistItemCreateRequest",
  updateChecklistItem: "ChecklistItemUpdateRequest",
  createTag: "TagCreateRequest",
  updateTag: "TagUpdateRequest",
  createRoutine: "RoutineCreateRequest",
  updateRoutine: "RoutineUpdateRequest",
  createRoutineStep: "RoutineStepCreateRequest",
  createRoutineSchedule: "RoutineScheduleCreateRequest",
  startFocusSession: "FocusSessionCreateRequest",
  updateFocusSession: "FocusSessionPatchRequest",
  updateUserSettings: "UserSettingsUpdateRequest",
  updateCategory: "CategoryUpdateRequest",
  runBatch: "BatchRequest",
  createMoodCheckin: "MoodCheckinRequest",
} as const;

const serverOwnedFields = [
  "id",
  "userId",
  "revision",
  "schemaVersion",
  "createdAt",
  "updatedAt",
  "deletedAt",
  "convertedTo",
];

function operationsById(): Record<string, OpenApiOperation> {
  const operations: Record<string, OpenApiOperation> = {};
  for (const pathItem of Object.values(spec.paths ?? {})) {
    for (const candidate of Object.values(pathItem)) {
      if (candidate?.operationId) {
        operations[candidate.operationId] = candidate;
      }
    }
  }
  return operations;
}

function refName(schema: JsonSchema | undefined): string | undefined {
  return schema?.$ref?.split("/").at(-1);
}

function isNullable(
  schema: JsonSchema | undefined,
  allComponents: Record<string, JsonSchema>,
  seen = new Set<string>(),
): boolean {
  if (!schema) return false;
  if (Array.isArray(schema.type) && schema.type.includes("null")) return true;
  if (schema.type === "null") return true;
  if (schema.anyOf?.some((entry) => isNullable(entry, allComponents, seen))) {
    return true;
  }
  if (schema.oneOf?.some((entry) => isNullable(entry, allComponents, seen))) {
    return true;
  }
  const name = refName(schema);
  if (name && !seen.has(name)) {
    const nextSeen = new Set(seen).add(name);
    return isNullable(allComponents[name], allComponents, nextSeen);
  }
  return false;
}

function dereference(
  schema: JsonSchema,
  allComponents: Record<string, JsonSchema>,
): JsonSchema {
  const name = refName(schema);
  return name ? (allComponents[name] ?? schema) : schema;
}

function nonNullBranch(
  schema: JsonSchema,
  allComponents: Record<string, JsonSchema>,
): JsonSchema {
  const resolved = dereference(schema, allComponents);
  const branches = resolved.anyOf ?? resolved.oneOf;
  return (
    branches?.find((branch) => !isNullable(branch, allComponents)) ?? resolved
  );
}

function objectContract(
  schema: JsonSchema,
  allComponents: Record<string, JsonSchema>,
  prefix = "",
): Record<string, { required: boolean; nullable: boolean }> {
  const resolved = nonNullBranch(schema, allComponents);
  const required = new Set(resolved.required ?? []);
  const contract: Record<string, { required: boolean; nullable: boolean }> = {};

  for (const [name, property] of Object.entries(resolved.properties ?? {})) {
    const path = prefix ? `${prefix}.${name}` : name;
    contract[path] = {
      required: required.has(name),
      nullable: isNullable(property, allComponents),
    };

    const child = nonNullBranch(property, allComponents);
    const nested = child.items
      ? objectContract(child.items, allComponents, `${path}[]`)
      : objectContract(child, allComponents, path);
    Object.assign(contract, nested);
  }

  return contract;
}

describe("request OpenAPI contract", () => {
  const requestSchemaRegistry = (
    schemaIndex as typeof schemaIndex & {
      requestSchemaRegistry?: Record<string, z.ZodType>;
    }
  ).requestSchemaRegistry;

  it("registers every request-only component and points every mutation at it", () => {
    expect(requestSchemaRegistry).toBeDefined();
    const operationIndex = operationsById();
    for (const [operationId, componentName] of Object.entries(
      expectedRequestOperations,
    )) {
      expect(
        requestSchemaRegistry,
        `${componentName} is absent from the request schema registry`,
      ).toHaveProperty(componentName);
      expect(
        refName(
          operationIndex[operationId]?.requestBody?.content?.["application/json"]
            ?.schema,
        ),
        `${operationId} must use its input component`,
      ).toBe(componentName);
    }
  });

  it("keeps request properties, requiredness, and nullability aligned with zod", () => {
    expect(requestSchemaRegistry).toBeDefined();
    if (!requestSchemaRegistry) return;

    for (const [name, validator] of Object.entries(requestSchemaRegistry)) {
      const component = components[name];
      expect(component, `${name} is absent from OpenAPI`).toBeDefined();

      const zodJson = z.toJSONSchema(validator, {
        target: "draft-2020-12",
        reused: "inline",
      }) as JsonSchema;
      // Focus patch is a discriminated union rather than one object.
      if (!zodJson.properties) {
        expect(component?.oneOf, `${name} must preserve its union branches`).toBeDefined();
        continue;
      }

      expect(objectContract(component ?? {}, components), name).toEqual(
        objectContract(zodJson, {}),
      );
    }
  });

  it("does not expose server-owned row fields in mutation inputs", () => {
    expect(requestSchemaRegistry).toBeDefined();
    if (!requestSchemaRegistry) return;

    for (const name of Object.keys(requestSchemaRegistry)) {
      const propertyNames = Object.keys(components[name]?.properties ?? {});
      expect(propertyNames.filter((field) => serverOwnedFields.includes(field)), name)
        .toEqual([]);
    }
    expect(Object.keys(components.RoutineStepCreateRequest?.properties ?? {}))
      .not.toContain("routineId");
    expect(Object.keys(components.RoutineScheduleCreateRequest?.properties ?? {}))
      .not.toContain("routineId");
    expect(Object.keys(components.RoutineScheduleCreateRequest?.properties ?? {}))
      .not.toContain("nextRunAt");
  });

  it("preserves the live routine create validator and nested path-body shapes", () => {
    const routineCreate = (
      routineSchemas as typeof routineSchemas & {
        routineCreate?: z.ZodType;
      }
    ).routineCreate;
    expect(routineCreate).toBeDefined();
    expect(
      routineCreate?.safeParse({
        title: "",
        steps: [{ title: "Start", durationMin: null }],
        schedule: { tz: "America/New_York", rrule: null },
      }).success,
    ).toBe(false);
    expect(
      routineCreate?.safeParse({
        title: "x".repeat(201),
        steps: [{ title: "Start", durationMin: null }],
        schedule: { tz: "America/New_York", rrule: null },
      }).success,
    ).toBe(false);
    expect(
      routineCreate?.safeParse({
        title: "Morning reset",
        steps: [{ title: "Start", durationMin: null }],
        schedule: { tz: "America/New_York", rrule: null },
      }).success,
    ).toBe(true);

    expect(
      Object.keys(
        components.RoutineCreateRequest?.properties?.steps?.items?.properties ?? {},
      ).sort(),
    ).toEqual(["durationMin", "title"]);
    expect(
      Object.keys(
        components.RoutineCreateRequest?.properties?.schedule?.properties ?? {},
      ).sort(),
    ).toEqual(["paused", "rrule", "tz"]);
  });

  it("documents the routine list and detail read models emitted by live routes", () => {
    const routineListItemResponse = (
      routineSchemas as typeof routineSchemas & {
        routineListItemResponse?: z.ZodType;
      }
    ).routineListItemResponse;
    const routineDetailResponse = (
      routineSchemas as typeof routineSchemas & {
        routineDetailResponse?: z.ZodType;
      }
    ).routineDetailResponse;

    expect(routineListItemResponse).toBeDefined();
    expect(routineDetailResponse).toBeDefined();
    expect(schemaIndex.responseSchemaRegistry).toHaveProperty("RoutineListItem");
    expect(schemaIndex.responseSchemaRegistry).toHaveProperty("RoutineDetail");

    const listOperation = operationsById().listRoutines;
    const listItems =
      listOperation?.responses?.["200"]?.content?.["application/json"]?.schema
        ?.properties?.items?.items;
    expect(refName(listItems)).toBe("RoutineListItem");
    expect(
      refName(
        operationsById().getRoutine?.responses?.["200"]?.content?.[
          "application/json"
        ]?.schema,
      ),
    ).toBe("RoutineDetail");

    expect(Object.keys(components.RoutineListItem?.properties ?? {})).toEqual(
      expect.arrayContaining(["steps", "schedules", "stepCount", "totalMin"]),
    );
    expect(Object.keys(components.RoutineDetail?.properties ?? {})).toEqual(
      expect.arrayContaining(["steps", "schedules"]),
    );
    expect(Object.keys(components.RoutineDetail?.properties ?? {})).not.toEqual(
      expect.arrayContaining(["stepCount", "totalMin"]),
    );
  });

  it("keeps nested routine response requiredness and nullability aligned with zod", () => {
    const responsePairs = [
      ["RoutineStep", routineSchemas.routineStepResponse],
      ["RoutineSchedule", routineSchemas.routineScheduleResponse],
    ] as const;

    for (const [componentName, validator] of responsePairs) {
      const zodJson = z.toJSONSchema(validator, {
        target: "draft-2020-12",
        reused: "inline",
      }) as JsonSchema;
      expect(
        objectContract(components[componentName] ?? {}, components),
        componentName,
      ).toEqual(objectContract(zodJson, {}));
    }
  });

  it("keeps routine totals truthful for existing negative-duration data", () => {
    const baseRoutine = {
      id: "0198f834-c9ab-7e12-b1cf-1faebad8f4fd",
      userId: "0198f834-c9ab-7e12-b1cf-1faebad8f4fe",
      title: "Legacy routine",
      emoji: null,
      categoryId: null,
      notes: null,
      revision: 1,
      createdAt: "2026-07-28T12:00:00Z",
      updatedAt: "2026-07-28T12:00:00Z",
      steps: [],
      schedules: [],
      stepCount: 0,
      totalMin: -5,
    };

    expect(routineSchemas.routineListItemResponse.safeParse(baseRoutine).success)
      .toBe(true);
    expect(components.RoutineListItem?.properties?.totalMin).not.toHaveProperty(
      "minimum",
    );
    expect(components.RoutineListItem?.properties?.stepCount).toMatchObject({
      minimum: 0,
    });
  });

  it("keeps arbitrary batch JSON and route-level shapes truthful", () => {
    expect(Object.keys(components.BatchOperation?.properties ?? {}).sort())
      .toEqual(["body", "idempotencyKey", "method", "path"]);
    expect([...(components.BatchOperation?.required ?? [])].sort()).toEqual([
      "method",
      "path",
    ]);
    expect(components.BatchOperation?.properties?.body).toEqual({});

    expect(components.BatchRequest?.properties?.operations?.maxItems).toBe(50);
    expect(components.BatchRequest?.properties?.operations).not.toHaveProperty(
      "minItems",
    );
    expect(Object.keys(components.BatchResult?.properties ?? {}).sort()).toEqual([
      "body",
      "status",
    ]);
    expect([...(components.BatchResult?.required ?? [])].sort()).toEqual([
      "body",
      "status",
    ]);
    expect(components.BatchResult?.properties?.body).toEqual({});
  });
});
