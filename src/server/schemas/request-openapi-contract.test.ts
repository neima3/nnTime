import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parse as parseYaml } from "yaml";
import { z } from "zod";
import * as schemaIndex from "./index";
import * as routineSchemas from "./routine";
import { validateSwiftPatchOverrides } from "./swift-patch-contract";

interface JsonSchema {
  "<<"?: JsonSchema;
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
const swiftPatchSource = readFileSync(
  resolve("ios/Kairo/Sources/Kairo/PatchRequests.swift"),
  "utf8",
);
const swiftContractTestSource = readFileSync(
  resolve("ios/Kairo/Tests/KairoTests/KairoContractTests.swift"),
  "utf8",
);

const expectedRequestOperations = {
  createAppleAuthChallenge: "AppleChallengeRequest",
  exchangeAppleCredential: "AppleExchangeRequest",
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
  const resolved = name ? (allComponents[name] ?? schema) : schema;
  return resolved["<<"] ? { ...resolved["<<"], ...resolved } : resolved;
}

function sortedValues(values: unknown[]): unknown[] {
  return [...values].sort((left, right) => {
    if (typeof left === "number" && typeof right === "number") {
      return left - right;
    }
    return JSON.stringify(left).localeCompare(JSON.stringify(right));
  });
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

  const minimumCandidates = [
    resolved.minimum,
    ...(kind === "integer" && resolved.exclusiveMinimum !== undefined
      ? [Math.floor(resolved.exclusiveMinimum) + 1]
      : []),
  ].filter((value): value is number => value !== undefined);
  const maximumCandidates = [
    resolved.maximum,
    ...(kind === "integer" && resolved.exclusiveMaximum !== undefined
      ? [Math.ceil(resolved.exclusiveMaximum) - 1]
      : []),
  ].filter((value): value is number => value !== undefined);
  const explicitMinimum = minimumCandidates.length
    ? Math.max(...minimumCandidates)
    : undefined;
  const explicitMaximum = maximumCandidates.length
    ? Math.min(...maximumCandidates)
    : undefined;
  const integerMinimum =
    kind === "integer" && !values?.length
      ? resolved.format === "int32"
        ? -2_147_483_648
        : -Number.MAX_SAFE_INTEGER
      : undefined;
  const integerMaximum =
    kind === "integer" && !values?.length
      ? resolved.format === "int32"
        ? 2_147_483_647
        : Number.MAX_SAFE_INTEGER
      : undefined;
  const minimum =
    explicitMinimum === undefined
      ? integerMinimum
      : integerMinimum === undefined
        ? explicitMinimum
        : Math.max(explicitMinimum, integerMinimum);
  const maximum =
    explicitMaximum === undefined
      ? integerMaximum
      : integerMaximum === undefined
        ? explicitMaximum
        : Math.min(explicitMaximum, integerMaximum);
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

interface SemanticNode {
  kind?: string | string[];
  maximum?: number;
  minimum?: number;
  properties?: Record<string, SemanticNode>;
  items?: SemanticNode;
  union?: SemanticNode[];
  values?: unknown[];
}

function semanticIntegerInventory(
  root: SemanticNode,
  rootPath: string,
): Record<
  string,
  { minimum?: number; maximum?: number; values?: unknown[] }
> {
  const inventory: Record<
    string,
    { minimum?: number; maximum?: number; values?: unknown[] }
  > = {};

  function visit(node: SemanticNode, path: string): void {
    if (node.kind === "integer") {
      inventory[path] = {
        ...(node.minimum === undefined ? {} : { minimum: node.minimum }),
        ...(node.maximum === undefined ? {} : { maximum: node.maximum }),
        ...(node.values === undefined ? {} : { values: node.values }),
      };
    }
    for (const [name, property] of Object.entries(node.properties ?? {})) {
      visit(property, `${path}.${name}`);
    }
    if (node.items) visit(node.items, `${path}[]`);
    for (const [index, branch] of (node.union ?? []).entries()) {
      const action = branch.properties?.action?.values?.[0];
      const branchName = typeof action === "string" ? action : String(index);
      visit(branch, `${path}<${branchName}>`);
    }
  }

  visit(root, rootPath);
  return inventory;
}

function requestIntegerInventory(
  componentNames: string[],
  allComponents: Record<string, JsonSchema>,
): Record<
  string,
  { minimum?: number; maximum?: number; values?: unknown[] }
> {
  return Object.assign(
    {},
    ...[...componentNames].sort().map((componentName) =>
      semanticIntegerInventory(
        semanticContract(
          allComponents[componentName] ?? {},
          allComponents,
        ) as SemanticNode,
        componentName,
      ),
    ),
  );
}

function responseIntegerInventoryIssues(
  allComponents: Record<string, JsonSchema>,
): string[] {
  const issues: string[] = [];
  for (const [componentName, validator] of Object.entries(
    schemaIndex.responseSchemaRegistry,
  )) {
    const component = allComponents[componentName];
    if (!component) {
      issues.push(componentName);
      continue;
    }
    const zodJson = z.toJSONSchema(validator, {
      target: "draft-2020-12",
      reused: "inline",
    }) as JsonSchema;
    const openApiInventory = semanticIntegerInventory(
      semanticContract(component, allComponents) as SemanticNode,
      componentName,
    );
    const zodInventory = semanticIntegerInventory(
      semanticContract(zodJson, {}) as SemanticNode,
      componentName,
    );
    if (JSON.stringify(openApiInventory) !== JSON.stringify(zodInventory)) {
      issues.push(
        `${componentName}: OpenAPI ${JSON.stringify(openApiInventory)} != Zod ${JSON.stringify(zodInventory)}`,
      );
    }
  }
  return issues;
}

function swiftFixtureWireKeyInventory(
  source: string,
): Record<string, string[]> {
  const inventory: Record<string, string[]> = {};
  for (const match of source.matchAll(
    /contractKeys\(\s*"([^"]+)",\s*\[([\s\S]*?)\]\s*\)/g,
  )) {
    inventory[match[1]!] = [...match[2]!.matchAll(/"([^"]+)"/g)]
      .map((key) => key[1]!)
      .sort();
  }
  return inventory;
}

function swiftNullableFixtureWireKeyInventory(
  source: string,
): Record<string, string[]> {
  const inventory: Record<string, string[]> = {};
  for (const match of source.matchAll(
    /contractNullKeys\(\s*"([^"]+)",\s*\[([\s\S]*?)\]\s*\)/g,
  )) {
    inventory[match[1]!] = [...match[2]!.matchAll(/"([^"]+)"/g)]
      .map((key) => key[1]!)
      .sort();
  }
  return inventory;
}

describe("request OpenAPI contract", () => {
  const clearablePatchNames = clearablePatchComponents(spec);
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
    expect(clearablePatchNames).toEqual([
      "ActivityOccurrencePatchRequest",
      "ActivitySeriesUpdateRequest",
      "RoutineUpdateRequest",
      "TagUpdateRequest",
      "TaskUpdateRequest",
    ]);
    const overrides = generatorConfig.typeOverrides?.schemas ?? {};
    expect(
      clearablePatchNames.filter((componentName) => !overrides[componentName]),
      "optional+nullable PATCH components without a typed Swift override",
    ).toEqual([]);
  });

  it("keeps every configured custom Swift override complete and tri-state-correct", () => {
    expect(
      validateSwiftPatchOverrides(
        components,
        generatorConfig,
        swiftPatchSource,
        clearablePatchNames,
      ),
    ).toEqual([]);
  });

  it("detects Swift override property inventory and nullability drift", () => {
    const mutations: Array<{
      name: string;
      mutate: (copy: Record<string, JsonSchema>) => void;
    }> = [
      {
        name: "added property",
        mutate: (copy) => {
          copy.TaskUpdateRequest!.properties!.futureField = { type: "string" };
        },
      },
      {
        name: "removed property",
        mutate: (copy) => {
          delete copy.TagUpdateRequest!.properties!.name;
        },
      },
      {
        name: "renamed property",
        mutate: (copy) => {
          const properties = copy.RoutineUpdateRequest!.properties!;
          properties.details = properties.notes!;
          delete properties.notes;
        },
      },
      {
        name: "nullable classification",
        mutate: (copy) => {
          copy.ActivitySeriesUpdateRequest!.properties!.rrule = {
            type: "string",
          };
        },
      },
      {
        name: "required-set optionality",
        mutate: (copy) => {
          copy.TaskUpdateRequest!.required = ["title"];
        },
      },
      {
        name: "same-name primitive",
        mutate: (copy) => {
          copy.TaskUpdateRequest!.properties!.title = { type: "boolean" };
        },
      },
      {
        name: "representation-changing format",
        mutate: (copy) => {
          copy.TaskUpdateRequest!.properties!.date!.format = "date-time";
        },
      },
      {
        name: "enum ref identity",
        mutate: (copy) => {
          copy.TaskUpdateRequest!.properties!.priority = {
            $ref: "#/components/schemas/EnergyLevel",
          };
        },
      },
      {
        name: "array item type",
        mutate: (copy) => {
          copy.ActivitySeriesUpdateRequest!.properties!.tags!.items = {
            type: "boolean",
          };
        },
      },
      {
        name: "local helper member type",
        mutate: (copy) => {
          copy.ActivitySeriesUpdateRequest!.properties!.checklistOverride!
            .items!.properties!.done = { type: "string" };
        },
      },
      {
        name: "free-form object container",
        mutate: (copy) => {
          copy.ActivityOccurrencePatchRequest!.properties!.checklistOverride = {
            type: ["string", "null"],
          };
        },
      },
    ];

    for (const mutation of mutations) {
      const mutated = structuredClone(components);
      mutation.mutate(mutated);
      expect(
        validateSwiftPatchOverrides(
          mutated,
          generatorConfig,
          swiftPatchSource,
          clearablePatchNames,
        ),
        mutation.name,
      ).not.toEqual([]);
    }
  });

  it("fails closed when a clearable override has a qualified unauditable type", () => {
    const mutatedConfig = structuredClone(generatorConfig);
    mutatedConfig.typeOverrides ??= {};
    mutatedConfig.typeOverrides.schemas ??= {};
    mutatedConfig.typeOverrides.schemas.TaskUpdateRequest =
      "ExternalModule.TaskUpdateRequest";

    expect(
      validateSwiftPatchOverrides(
        components,
        mutatedConfig,
        swiftPatchSource,
        clearablePatchNames,
      ),
    ).toContain(
      "TaskUpdateRequest: cannot source-audit Swift struct ExternalModule.TaskUpdateRequest",
    );
  });

  it("detects missing and mis-keyed custom Swift codec paths", () => {
    const mutations = [
      {
        name: "missing encode",
        from: "        try container.encodeIfPresent(name, forKey: .name)\n",
        to: "",
      },
      {
        name: "mis-keyed encode",
        from: "        try container.encodePatchField(color, forKey: .color)\n",
        to: "        try container.encodePatchField(color, forKey: .name)\n",
      },
      {
        name: "duplicate encode",
        from: "        try container.encodePatchField(color, forKey: .color)\n",
        to:
          "        try container.encodePatchField(color, forKey: .color)\n" +
          "        try container.encodePatchField(color, forKey: .color)\n",
      },
      {
        name: "missing decode",
        from:
          "        name = try container.decodeIfPresent(String.self, forKey: .name)\n",
        to: "",
      },
      {
        name: "mis-keyed decode",
        from:
          "        color = try container.decodePatchField(String.self, forKey: .color)\n",
        to:
          "        color = try container.decodePatchField(String.self, forKey: .name)\n",
      },
      {
        name: "wrong nullable decode operation",
        from:
          "        color = try container.decodePatchField(String.self, forKey: .color)\n",
        to:
          "        color = try container.decodeIfPresent(String.self, forKey: .color)\n",
      },
      {
        name: "missing CodingKeys case",
        from: "        case name\n        case color\n",
        to: "        case name\n",
      },
      {
        name: "mis-keyed CodingKeys case",
        from: "        case name\n        case color\n",
        to: '        case name\n        case color = "name"\n',
      },
    ];

    const undetected = mutations.flatMap((mutation) => {
      const mutatedSource = swiftPatchSource.replace(mutation.from, mutation.to);
      expect(mutatedSource, mutation.name).not.toBe(swiftPatchSource);
      return validateSwiftPatchOverrides(
        components,
        generatorConfig,
        mutatedSource,
        clearablePatchNames,
      ).length === 0
        ? [mutation.name]
        : [];
    });
    expect(undetected).toEqual([]);
  });

  it("keeps exhaustive Swift round-trip fixtures synced to every custom override", () => {
    const fixtureInventory = swiftFixtureWireKeyInventory(
      swiftContractTestSource,
    );
    const overrides = generatorConfig.typeOverrides?.schemas ?? {};
    const expected = Object.fromEntries(
      clearablePatchNames.map((componentName) => [
        overrides[componentName],
        Object.keys(components[componentName]?.properties ?? {}).sort(),
      ]),
    );
    expect(fixtureInventory).toEqual(expected);
  });

  it("keeps exhaustive Swift explicit-null fixtures synced to OpenAPI nullability", () => {
    const overrides = generatorConfig.typeOverrides?.schemas ?? {};
    const expected = Object.fromEntries(
      clearablePatchNames.map((componentName) => [
        overrides[componentName],
        Object.entries(components[componentName]?.properties ?? {})
          .filter(([, property]) => isNullable(property, components))
          .map(([propertyName]) => propertyName)
          .sort(),
      ]),
    );
    expect(
      swiftNullableFixtureWireKeyInventory(swiftContractTestSource),
    ).toEqual(expected);

    const fixtureWithoutNullableValue = swiftContractTestSource.replace(
      "                notes: .null,\n                sourceRef: .null,",
      "                sourceRef: .null,",
    );
    expect(fixtureWithoutNullableValue).not.toBe(swiftContractTestSource);
    const mutatedFixture = fixtureWithoutNullableValue.replace(
        '                "notes",\n                "sourceRef",',
        '                "sourceRef",',
      );
    expect(mutatedFixture).not.toBe(fixtureWithoutNullableValue);
    expect(swiftNullableFixtureWireKeyInventory(mutatedFixture)).not.toEqual(
      expected,
    );
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

  it("enforces exact persisted integer boundaries in every scoped request schema", () => {
    const uuid = "0198f834-c9ab-7e12-b1cf-1faebad8f4fd";
    const int32 = {
      minimum: -2_147_483_648,
      maximum: 2_147_483_647,
    };
    const smallint = { minimum: -32_768, maximum: 32_767 };
    const boundaryCases: Array<{
      name: string;
      validator: z.ZodType;
      input: (value: number) => unknown;
      minimum: number;
      maximum: number;
    }> = [
      {
        name: "activity create duration",
        validator: schemaIndex.activitySeriesCreate,
        input: (durationMin) => ({
          tz: "America/New_York",
          dtstartLocal: "2026-07-28T12:00:00Z",
          title: "Plan",
          durationMin,
        }),
        ...int32,
      },
      {
        name: "activity update duration",
        validator: schemaIndex.activitySeriesUpdate,
        input: (durationMin) => ({ durationMin }),
        ...int32,
      },
      {
        name: "occurrence override duration",
        validator: schemaIndex.activityOccurrencePatch,
        input: (durationMin) => ({ durationMin }),
        ...int32,
      },
      {
        name: "routine create step duration",
        validator: schemaIndex.routineCreate,
        input: (durationMin) => ({
          title: "Routine",
          steps: [{ title: "Step", durationMin }],
        }),
        ...int32,
      },
      {
        name: "routine step create duration",
        validator: schemaIndex.routineStepCreate,
        input: (durationMin) => ({ title: "Step", durationMin }),
        ...int32,
      },
      {
        name: "routine step update duration",
        validator: schemaIndex.routineStepUpdate,
        input: (durationMin) => ({ durationMin }),
        ...int32,
      },
      {
        name: "category order",
        validator: schemaIndex.categoryUpdate,
        input: (sortOrder) => ({ sortOrder }),
        ...smallint,
      },
      {
        name: "checklist create order",
        validator: schemaIndex.checklistItemCreate,
        input: (sortOrder) => ({
          parentType: "task",
          parentId: uuid,
          label: "Step",
          sortOrder,
        }),
        ...smallint,
      },
      {
        name: "checklist update order",
        validator: schemaIndex.checklistItemUpdate,
        input: (sortOrder) => ({ sortOrder }),
        ...smallint,
      },
      {
        name: "routine step create order",
        validator: schemaIndex.routineStepCreate,
        input: (sortOrder) => ({ title: "Step", sortOrder }),
        ...smallint,
      },
      {
        name: "routine step update order",
        validator: schemaIndex.routineStepUpdate,
        input: (sortOrder) => ({ sortOrder }),
        ...smallint,
      },
      {
        name: "settings week start",
        validator: schemaIndex.userSettingsUpdate,
        input: (weekStart) => ({ weekStart }),
        minimum: 0,
        maximum: 6,
      },
      {
        name: "focus target duration",
        validator: schemaIndex.focusSessionCreateRequest,
        input: (targetDurationMin) => ({ targetDurationMin }),
        minimum: 1,
        maximum: 1_440,
      },
    ];

    for (const boundary of boundaryCases) {
      expect(
        boundary.validator.safeParse(boundary.input(boundary.minimum)).success,
        `${boundary.name} minimum`,
      ).toBe(true);
      expect(
        boundary.validator.safeParse(boundary.input(boundary.maximum)).success,
        `${boundary.name} maximum`,
      ).toBe(true);
      expect(
        boundary.validator.safeParse(boundary.input(boundary.minimum - 1))
          .success,
        `${boundary.name} below minimum`,
      ).toBe(false);
      expect(
        boundary.validator.safeParse(boundary.input(boundary.maximum + 1))
          .success,
        `${boundary.name} above maximum`,
      ).toBe(false);
    }
  });

  it("inventories every documented request integer and its exact wire range", () => {
    const int32 = {
      minimum: -2_147_483_648,
      maximum: 2_147_483_647,
    };
    const smallint = { minimum: -32_768, maximum: 32_767 };
    expect(
      requestIntegerInventory(Object.keys(requestSchemaRegistry), components),
    ).toEqual({
      "ActivityOccurrencePatchRequest.durationMin": int32,
      "ActivitySeriesCreateRequest.durationMin": int32,
      "ActivitySeriesUpdateRequest.durationMin": int32,
      "CategoryUpdateRequest.sortOrder": smallint,
      "ChecklistItemCreateRequest.sortOrder": smallint,
      "ChecklistItemUpdateRequest.sortOrder": smallint,
      "FocusSessionCreateRequest.targetDurationMin": {
        minimum: 1,
        maximum: 1_440,
      },
      "FocusSessionPatchRequest<extend>.addMinutes": {
        values: [1, 5, 10],
      },
      "RoutineCreateRequest.steps[].durationMin": int32,
      "RoutineStepCreateRequest.durationMin": int32,
      "RoutineStepCreateRequest.sortOrder": smallint,
      "UserSettingsUpdateRequest.weekStart": {
        minimum: 0,
        maximum: 6,
      },
    });
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

  it("keeps every registered response integer inventory aligned", () => {
    expect(responseIntegerInventoryIssues(components)).toEqual([]);
  });

  it("detects a response component whose sole int32 format is deleted", () => {
    const mutated = structuredClone(components);
    mutated.Tag!.properties!.revision = structuredClone(mutated.Revision!);
    delete mutated.Tag!.properties!.revision!.format;
    expect(
      responseIntegerInventoryIssues(mutated).some((issue) =>
        issue.startsWith("Tag:"),
      ),
    ).toBe(true);
  });

  it("bounds persisted settings schemaVersion to PostgreSQL integer width", () => {
    const schemaVersion = schemaIndex.userSettingsResponse.shape.schemaVersion;
    expect(schemaVersion.safeParse(-2_147_483_648).success).toBe(true);
    expect(schemaVersion.safeParse(2_147_483_647).success).toBe(true);
    expect(schemaVersion.safeParse(-2_147_483_649).success).toBe(false);
    expect(schemaVersion.safeParse(2_147_483_648).success).toBe(false);
  });

  it("keeps routine computed aggregates truthful beyond Int32", () => {
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
    const largeAggregate = {
      ...baseRoutine,
      stepCount: 2_147_483_648,
      totalMin: 2_147_483_648,
    };
    expect(
      routineSchemas.routineListItemResponse.safeParse(largeAggregate).success,
    ).toBe(true);
    const zodJson = z.toJSONSchema(
      routineSchemas.routineListItemResponse,
    ) as JsonSchema;
    expect(
      semanticContract(components.RoutineListItem ?? {}, components),
    ).toEqual(semanticContract(zodJson, {}));
    expect(components.RoutineListItem?.properties?.totalMin).not.toHaveProperty(
      "format",
    );
    expect(components.RoutineListItem?.properties?.totalMin).toMatchObject({
      minimum: -Number.MAX_SAFE_INTEGER,
      maximum: Number.MAX_SAFE_INTEGER,
    });
    expect(components.RoutineListItem?.properties?.stepCount).toMatchObject({
      minimum: 0,
      maximum: 4_294_967_295,
    });
  });

  it("intersects simultaneous inclusive, exclusive, and int32 bounds", () => {
    const lowerCombined = semanticContract(
      {
        type: "integer",
        format: "int32",
        minimum: 12,
        exclusiveMinimum: 10,
      },
      {},
    );
    expect(lowerCombined).toEqual(
      semanticContract(
        { type: "integer", format: "int32", minimum: 12 },
        {},
      ),
    );
    expect(lowerCombined).not.toEqual(
      semanticContract(
        { type: "integer", format: "int32", minimum: 11 },
        {},
      ),
    );

    const upperCombined = semanticContract(
      {
        type: "integer",
        format: "int32",
        maximum: 8,
        exclusiveMaximum: 10,
      },
      {},
    );
    expect(upperCombined).toEqual(
      semanticContract(
        { type: "integer", format: "int32", maximum: 8 },
        {},
      ),
    );
    expect(upperCombined).not.toEqual(
      semanticContract(
        { type: "integer", format: "int32", maximum: 9 },
        {},
      ),
    );
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
        name: "int32 width",
        componentName: "ActivitySeriesCreateRequest",
        mutate: (copy) => {
          delete copy.ActivitySeriesCreateRequest!.properties!.durationMin!
            .format;
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
