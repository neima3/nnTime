import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parse as parseYaml } from "yaml";
import { z } from "zod";
import * as schemaIndex from "./index";
import * as routineSchemas from "./routine";

interface JsonSchema {
  $ref?: string;
  additionalProperties?: boolean | JsonSchema;
  anyOf?: JsonSchema[];
  const?: unknown;
  enum?: unknown[];
  exclusiveMaximum?: number;
  exclusiveMinimum?: number;
  format?: string;
  maxLength?: number;
  minLength?: number;
  maximum?: number;
  minimum?: number;
  minItems?: number;
  oneOf?: JsonSchema[];
  pattern?: string;
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

interface GeneratorConfig {
  typeOverrides?: { schemas?: Record<string, string> };
}

const spec = parseYaml(
  readFileSync(resolve("api/openapi.yaml"), "utf8"),
) as OpenApiSpec;
const components = spec.components?.schemas ?? {};
const generatorConfig = parseYaml(
  readFileSync(
    resolve("ios/Kairo/Sources/Kairo/openapi-generator-config.yaml"),
    "utf8",
  ),
) as GeneratorConfig;

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

function requestBodyInventory(
  source: OpenApiSpec,
): Record<string, string | undefined> {
  const inventory: Record<string, string | undefined> = {};
  for (const pathItem of Object.values(source.paths ?? {})) {
    for (const method of ["get", "post", "put", "patch", "delete"]) {
      const operation = pathItem[method];
      const requestSchema =
        operation?.requestBody?.content?.["application/json"]?.schema;
      if (operation?.operationId && requestSchema) {
        inventory[operation.operationId] = refName(requestSchema);
      }
    }
  }
  return inventory;
}

function clearablePatchComponents(source: OpenApiSpec): string[] {
  const result = new Set<string>();
  const sourceComponents = source.components?.schemas ?? {};
  for (const pathItem of Object.values(source.paths ?? {})) {
    const operation = pathItem.patch;
    const name = refName(
      operation?.requestBody?.content?.["application/json"]?.schema,
    );
    if (!name) continue;
    const component = sourceComponents[name];
    const required = new Set(component?.required ?? []);
    const hasOptionalNullable = Object.entries(component?.properties ?? {}).some(
      ([propertyName, property]) =>
        !required.has(propertyName) &&
        isNullable(property, sourceComponents),
    );
    if (hasOptionalNullable) result.add(name);
  }
  return [...result].sort();
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

function sortedValues(values: unknown[]): unknown[] {
  return [...values].sort((left, right) =>
    JSON.stringify(left).localeCompare(JSON.stringify(right)),
  );
}

function literalValues(
  schema: JsonSchema,
  allComponents: Record<string, JsonSchema>,
): unknown[] | undefined {
  const resolved = dereference(schema, allComponents);
  if ("const" in resolved) return [resolved.const];
  if (resolved.enum) return resolved.enum;

  const branches = resolved.anyOf;
  if (!branches?.length) return undefined;
  const branchValues = branches.map((branch) =>
    literalValues(branch, allComponents),
  );
  if (branchValues.some((values) => !values)) return undefined;
  return branchValues.flatMap((values) => values ?? []);
}

function isNullOnly(
  schema: JsonSchema,
  allComponents: Record<string, JsonSchema>,
): boolean {
  const resolved = dereference(schema, allComponents);
  const values = literalValues(resolved, allComponents);
  if (values?.length) return values.every((value) => value === null);
  return resolved.type === "null";
}

function semanticContract(
  schema: JsonSchema,
  allComponents: Record<string, JsonSchema>,
): unknown {
  const resolved = dereference(schema, allComponents);
  const union = resolved.anyOf ?? resolved.oneOf;
  const nullableFromType =
    Array.isArray(resolved.type) && resolved.type.includes("null");
  const nullableFromEnum = resolved.enum?.includes(null) ?? false;
  const nullBranches = union?.filter((branch) =>
    isNullOnly(branch, allComponents),
  );
  const nonNullBranches = union?.filter(
    (branch) => !isNullOnly(branch, allComponents),
  );

  if (nullBranches?.length && nonNullBranches?.length === 1) {
    const inner = semanticContract(nonNullBranches[0]!, allComponents);
    return typeof inner === "object" && inner !== null
      ? { ...inner, nullable: true }
      : { contract: inner, nullable: true };
  }

  const values = literalValues(resolved, allComponents)?.filter(
    (value) => value !== null,
  );
  const rawTypes = Array.isArray(resolved.type)
    ? resolved.type.filter((type) => type !== "null")
    : resolved.type
      ? [resolved.type]
      : [];
  let kind: string | string[] | undefined =
    rawTypes.length === 1
      ? rawTypes[0]
      : rawTypes.length > 1
        ? [...rawTypes].sort()
        : undefined;
  if (!kind && resolved.properties) kind = "object";
  if (!kind && resolved.items) kind = "array";
  if (
    values?.length &&
    values.every((value) => typeof value === "number" && Number.isInteger(value))
  ) {
    kind = "integer";
  }

  const nullable = nullableFromType || nullableFromEnum;
  const common = {
    ...(nullable ? { nullable: true } : {}),
    ...(values?.length ? { values: sortedValues(values) } : {}),
  };

  if (union?.length && !values) {
    return {
      ...common,
      union: union
        .map((branch) => semanticContract(branch, allComponents))
        .sort((left, right) =>
          JSON.stringify(left).localeCompare(JSON.stringify(right)),
        ),
    };
  }

  if (kind === "object") {
    const required = [...(resolved.required ?? [])].sort();
    const properties = Object.fromEntries(
      Object.entries(resolved.properties ?? {})
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([name, property]) => [
          name,
          semanticContract(property, allComponents),
        ]),
    );
    const additionalProperties =
      resolved.additionalProperties === true ||
      (typeof resolved.additionalProperties === "object" &&
        Object.keys(resolved.additionalProperties).length === 0)
        ? "any"
        : typeof resolved.additionalProperties === "object"
          ? semanticContract(resolved.additionalProperties, allComponents)
          : undefined;
    return {
      ...common,
      kind,
      required,
      properties,
      ...(additionalProperties === undefined
        ? {}
        : { additionalProperties }),
    };
  }

  if (kind === "array") {
    return {
      ...common,
      kind,
      items: semanticContract(resolved.items ?? {}, allComponents),
      ...(resolved.minItems === undefined
        ? {}
        : { minItems: resolved.minItems }),
      ...(resolved.maxItems === undefined
        ? {}
        : { maxItems: resolved.maxItems }),
    };
  }

  const defaultIntegerMinimum = -Number.MAX_SAFE_INTEGER;
  const defaultIntegerMaximum = Number.MAX_SAFE_INTEGER;
  const minimum =
    kind === "integer" && resolved.exclusiveMinimum !== undefined
      ? Math.floor(resolved.exclusiveMinimum) + 1
      : kind === "integer" && resolved.minimum === defaultIntegerMinimum
        ? undefined
        : resolved.minimum;
  const maximum =
    kind === "integer" && resolved.exclusiveMaximum !== undefined
      ? Math.ceil(resolved.exclusiveMaximum) - 1
      : kind === "integer" && resolved.maximum === defaultIntegerMaximum
        ? undefined
        : resolved.maximum;
  const format = resolved.format === "int32" ? undefined : resolved.format;
  return {
    ...common,
    ...(kind ? { kind } : { kind: "any" }),
    ...(format ? { format } : {}),
    ...(resolved.minLength === undefined
      ? {}
      : { minLength: resolved.minLength }),
    ...(resolved.maxLength === undefined
      ? {}
      : { maxLength: resolved.maxLength }),
    ...(minimum === undefined ? {} : { minimum }),
    ...(maximum === undefined ? {} : { maximum }),
    ...(kind !== "integer" && resolved.exclusiveMinimum !== undefined
      ? { exclusiveMinimum: resolved.exclusiveMinimum }
      : {}),
    ...(kind !== "integer" && resolved.exclusiveMaximum !== undefined
      ? { exclusiveMaximum: resolved.exclusiveMaximum }
      : {}),
    ...(format || resolved.pattern === undefined
      ? {}
      : { pattern: resolved.pattern }),
  };
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
    expect(requestBodyInventory(spec)).toEqual(expectedRequestOperations);
  });

  it("requires generated type overrides for every clearable PATCH body", () => {
    const clearable = clearablePatchComponents(spec);
    expect(clearable).toEqual([
      "ActivityOccurrencePatchRequest",
      "ActivitySeriesUpdateRequest",
      "RoutineUpdateRequest",
      "TagUpdateRequest",
      "TaskUpdateRequest",
    ]);
    const overrides = generatorConfig.typeOverrides?.schemas ?? {};
    expect(
      clearable.filter((componentName) => !overrides[componentName]),
      "optional+nullable PATCH components without a typed Swift override",
    ).toEqual([]);
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
      expect(semanticContract(component ?? {}, components), name).toEqual(
        semanticContract(zodJson, {}),
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
        semanticContract(components[componentName] ?? {}, components),
        componentName,
      ).toEqual(semanticContract(zodJson, {}));
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

  it("detects type, enum, limit, additional-property, and union drift", () => {
    const cases: Array<{
      name: string;
      componentName: string;
      mutate: (copy: Record<string, JsonSchema>) => void;
    }> = [
      {
        name: "primitive type",
        componentName: "TaskCreateRequest",
        mutate: (copy) => {
          copy.TaskCreateRequest!.properties!.title!.type = "integer";
        },
      },
      {
        name: "referenced enum",
        componentName: "TaskCreateRequest",
        mutate: (copy) => {
          copy.TaskBucket!.enum = ["inbox"];
        },
      },
      {
        name: "string limit",
        componentName: "RoutineCreateRequest",
        mutate: (copy) => {
          copy.RoutineCreateRequest!.properties!.title!.maxLength = 199;
        },
      },
      {
        name: "string format",
        componentName: "TaskCreateRequest",
        mutate: (copy) => {
          copy.TaskCreateRequest!.properties!.date!.format = "date-time";
        },
      },
      {
        name: "numeric limit",
        componentName: "FocusSessionCreateRequest",
        mutate: (copy) => {
          copy.FocusSessionCreateRequest!.properties!.targetDurationMin!
            .maximum = 1439;
        },
      },
      {
        name: "array bound",
        componentName: "BatchRequest",
        mutate: (copy) => {
          copy.BatchRequest!.properties!.operations!.maxItems = 49;
        },
      },
      {
        name: "array items",
        componentName: "BatchRequest",
        mutate: (copy) => {
          copy.BatchRequest!.properties!.operations!.items = { type: "string" };
        },
      },
      {
        name: "additional properties",
        componentName: "UserSettingsUpdateRequest",
        mutate: (copy) => {
          copy.UserSettingsUpdateRequest!.properties!.notificationPrefs!
            .additionalProperties = false;
        },
      },
      {
        name: "focus union enum",
        componentName: "FocusSessionPatchRequest",
        mutate: (copy) => {
          copy.FocusSessionPatchRequest!.oneOf![1]!.properties!.addMinutes!.enum =
            [1, 5];
        },
      },
      {
        name: "focus union const",
        componentName: "FocusSessionPatchRequest",
        mutate: (copy) => {
          copy.FocusSessionPatchRequest!.oneOf![0]!.properties!.action!.const =
            "cancel";
        },
      },
    ];

    for (const testCase of cases) {
      const mutated = structuredClone(components);
      testCase.mutate(mutated);
      expect(
        semanticContract(mutated[testCase.componentName]!, mutated),
        testCase.name,
      ).not.toEqual(
        semanticContract(components[testCase.componentName]!, components),
      );
    }
  });

  it("detects newly documented request bodies outside the operation inventory", () => {
    const mutated = structuredClone(spec);
    mutated.paths = {
      ...mutated.paths,
      "/future-mutation": {
        post: {
          operationId: "futureMutation",
          requestBody: {
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/TaskCreateRequest" },
              },
            },
          },
        },
      },
    };

    expect(requestBodyInventory(mutated)).not.toEqual(expectedRequestOperations);
  });
});
