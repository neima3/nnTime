interface ContractSchema {
  $ref?: string;
  additionalProperties?: boolean | ContractSchema;
  anyOf?: ContractSchema[];
  format?: string;
  items?: ContractSchema;
  oneOf?: ContractSchema[];
  properties?: Record<string, ContractSchema>;
  required?: string[];
  type?: string | string[];
}

interface SwiftGeneratorConfig {
  typeOverrides?: {
    schemas?: Record<string, string>;
  };
}

function refName(schema: ContractSchema): string | undefined {
  return schema.$ref?.split("/").at(-1);
}

function isNullable(
  schema: ContractSchema,
  components: Record<string, ContractSchema>,
  seen = new Set<string>(),
): boolean {
  if (schema.type === "null") return true;
  if (Array.isArray(schema.type) && schema.type.includes("null")) return true;
  if (schema.anyOf?.some((branch) => isNullable(branch, components, seen))) {
    return true;
  }
  if (schema.oneOf?.some((branch) => isNullable(branch, components, seen))) {
    return true;
  }

  const name = refName(schema);
  if (!name || seen.has(name) || !components[name]) return false;
  return isNullable(
    components[name],
    components,
    new Set(seen).add(name),
  );
}

function nonNullSchema(
  schema: ContractSchema,
  components: Record<string, ContractSchema>,
): ContractSchema {
  if (schema.$ref) return schema;
  const branches = schema.anyOf ?? schema.oneOf;
  if (branches) {
    const nonNull = branches.filter(
      (branch) => !isNullable(branch, components),
    );
    if (nonNull.length === 1) return nonNull[0]!;
  }
  if (Array.isArray(schema.type)) {
    const types = schema.type.filter((type) => type !== "null");
    return {
      ...schema,
      type: types.length === 1 ? types[0] : types,
    };
  }
  return schema;
}

function declarationBody(
  source: string,
  declaration: string,
): string | undefined {
  const declarationIndex = source.indexOf(declaration);
  if (declarationIndex === -1) return undefined;
  const openingBrace = source.indexOf("{", declarationIndex);
  if (openingBrace === -1) return undefined;

  let depth = 0;
  for (let index = openingBrace; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;
    if (depth === 0) return source.slice(openingBrace + 1, index);
  }
  return undefined;
}

function structBody(source: string, typeName: string): string | undefined {
  return declarationBody(source, `public struct ${typeName}`);
}

function swiftProperties(
  source: string,
  typeName: string,
): Record<string, string> | undefined {
  const body = structBody(source, typeName);
  if (body === undefined) return undefined;

  const result: Record<string, string> = {};
  for (const match of body.matchAll(
    /^\s*public var ([A-Za-z_][A-Za-z0-9_]*): (.+?)\s*$/gm,
  )) {
    result[match[1]!] = match[2]!;
  }
  return result;
}

interface SwiftWireMapping {
  key: string;
  operation?: string;
  property: string;
}

function swiftCodingKeys(structSource: string): SwiftWireMapping[] | undefined {
  const body = declarationBody(structSource, "private enum CodingKeys");
  if (body === undefined) return undefined;
  const mappings: SwiftWireMapping[] = [];
  for (const match of body.matchAll(
    /^\s*case\s+([A-Za-z_][A-Za-z0-9_]*)(?:\s*=\s*"([^"]+)")?\s*$/gm,
  )) {
    mappings.push({
      property: match[1]!,
      key: match[2] ?? match[1]!,
    });
  }
  return mappings;
}

function swiftDecoderMappings(
  structSource: string,
): SwiftWireMapping[] | undefined {
  const body = declarationBody(structSource, "public init(from decoder");
  if (body === undefined) return undefined;
  return [...body.matchAll(
    /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*try\s+container\.(decodeIfPresent|decodePatchField)\([\s\S]*?forKey:\s*\.([A-Za-z_][A-Za-z0-9_]*)\s*\)\s*$/gm,
  )].map((match) => ({
    property: match[1]!,
    operation: match[2]!,
    key: match[3]!,
  }));
}

function swiftEncoderMappings(
  structSource: string,
): SwiftWireMapping[] | undefined {
  const body = declarationBody(structSource, "public func encode(to encoder");
  if (body === undefined) return undefined;
  return [...body.matchAll(
    /^\s*try\s+container\.(encodeIfPresent|encodePatchField)\(\s*([A-Za-z_][A-Za-z0-9_]*)\s*,[\s\S]*?forKey:\s*\.([A-Za-z_][A-Za-z0-9_]*)\s*\)\s*$/gm,
  )].map((match) => ({
    operation: match[1]!,
    property: match[2]!,
    key: match[3]!,
  }));
}

function validateWireMappings(
  componentName: string,
  label: string,
  expectedProperties: string[],
  mappings: SwiftWireMapping[] | undefined,
  issues: string[],
  expectedOperation?: (propertyName: string) => string,
): void {
  if (!mappings) {
    issues.push(`${componentName}: missing Swift ${label}`);
    return;
  }

  const expected = new Set(expectedProperties);
  for (const propertyName of expectedProperties) {
    const byProperty = mappings.filter(
      (mapping) => mapping.property === propertyName,
    );
    if (byProperty.length !== 1) {
      issues.push(
        `${componentName}.${propertyName}: Swift ${label} occurrences=${byProperty.length}, expected=1`,
      );
      continue;
    }
    if (byProperty[0]!.key !== propertyName) {
      issues.push(
        `${componentName}.${propertyName}: Swift ${label} key=${byProperty[0]!.key}, expected=${propertyName}`,
      );
    }
    const operation = expectedOperation?.(propertyName);
    if (operation && byProperty[0]!.operation !== operation) {
      issues.push(
        `${componentName}.${propertyName}: Swift ${label} operation=${byProperty[0]!.operation}, expected=${operation}`,
      );
    }
  }

  for (const mapping of mappings) {
    if (!expected.has(mapping.property)) {
      issues.push(
        `${componentName}: unexpected Swift ${label} property ${mapping.property}`,
      );
    }
  }

  const keyCounts = new Map<string, number>();
  for (const mapping of mappings) {
    keyCounts.set(mapping.key, (keyCounts.get(mapping.key) ?? 0) + 1);
  }
  for (const [key, count] of keyCounts) {
    if (count > 1) {
      issues.push(
        `${componentName}: duplicate Swift ${label} key ${key} (${count})`,
      );
    }
  }
}

function validateCustomCodecShape(
  componentName: string,
  schema: ContractSchema,
  swiftType: string,
  components: Record<string, ContractSchema>,
  swiftSource: string,
  issues: string[],
): void {
  const body = structBody(swiftSource, swiftType);
  if (body === undefined) return;
  const expectedProperties = Object.keys(schema.properties ?? {}).sort();
  const usesPatchField = (propertyName: string): boolean =>
    isNullable(schema.properties?.[propertyName] ?? {}, components);
  validateWireMappings(
    componentName,
    "CodingKeys",
    expectedProperties,
    swiftCodingKeys(body),
    issues,
  );
  validateWireMappings(
    componentName,
    "decoder mapping",
    expectedProperties,
    swiftDecoderMappings(body),
    issues,
    (propertyName) =>
      usesPatchField(propertyName) ? "decodePatchField" : "decodeIfPresent",
  );
  validateWireMappings(
    componentName,
    "encoder mapping",
    expectedProperties,
    swiftEncoderMappings(body),
    issues,
    (propertyName) =>
      usesPatchField(propertyName) ? "encodePatchField" : "encodeIfPresent",
  );
}

function normalizeSwiftType(swiftType: string): string {
  return swiftType
    .replaceAll("Swift.String", "String")
    .replaceAll("Swift.Bool", "Bool")
    .replaceAll("Swift.Int32", "Int32")
    .replaceAll("Swift.Int", "Int")
    .replaceAll("Foundation.Date", "Date")
    .replaceAll(
      "OpenAPIRuntime.OpenAPIObjectContainer",
      "OpenAPIObjectContainer",
    )
    .trim();
}

function withoutOuterOptional(swiftType: string): string {
  return swiftType.endsWith("?") ? swiftType.slice(0, -1) : swiftType;
}

function patchFieldInner(swiftType: string): string | undefined {
  if (!swiftType.startsWith("PatchField<") || !swiftType.endsWith(">")) {
    return undefined;
  }
  return swiftType.slice("PatchField<".length, -1);
}

function arrayInner(swiftType: string): string | undefined {
  if (!swiftType.startsWith("[") || !swiftType.endsWith("]")) return undefined;
  return swiftType.slice(1, -1);
}

function expectedPrimitiveType(schema: ContractSchema): string | undefined {
  if (schema.type === "string") {
    return schema.format === "date-time" ? "Date" : "String";
  }
  if (schema.type === "boolean") return "Bool";
  if (schema.type === "integer") {
    return schema.format === "int32" ? "Int32" : "Int";
  }
  if (schema.type === "number") return "Double";
  return undefined;
}

function validateStructShape(
  componentName: string,
  schema: ContractSchema,
  swiftType: string,
  components: Record<string, ContractSchema>,
  overrides: Record<string, string>,
  swiftSource: string,
  issues: string[],
  activeLocalTypes: Set<string>,
): void {
  const actualProperties = swiftProperties(swiftSource, swiftType);
  if (!actualProperties) {
    issues.push(`${componentName}: cannot source-audit Swift struct ${swiftType}`);
    return;
  }

  const expectedProperties = schema.properties ?? {};
  const expectedNames = Object.keys(expectedProperties).sort();
  const actualNames = Object.keys(actualProperties).sort();
  const missing = expectedNames.filter((name) => !actualProperties[name]);
  const extra = actualNames.filter((name) => !expectedProperties[name]);
  if (missing.length) {
    issues.push(`${componentName}: missing Swift properties ${missing.join(", ")}`);
  }
  if (extra.length) {
    issues.push(`${componentName}: extra Swift properties ${extra.join(", ")}`);
  }

  const required = new Set(schema.required ?? []);
  for (const propertyName of expectedNames) {
    const propertySchema = expectedProperties[propertyName]!;
    const rawSwiftType = actualProperties[propertyName];
    if (!rawSwiftType) continue;
    const propertyPath = `${componentName}.${propertyName}`;
    const normalized = normalizeSwiftType(rawSwiftType);
    const expectedOptional = !required.has(propertyName);
    const actualOptional = normalized.endsWith("?");
    if (actualOptional !== expectedOptional) {
      issues.push(
        `${propertyPath}: Swift optional=${actualOptional}, OpenAPI optional=${expectedOptional}`,
      );
    }

    const expectedNullable = isNullable(propertySchema, components);
    const optionalInner = withoutOuterOptional(normalized);
    const patchInner = patchFieldInner(optionalInner);
    const actualNullable = patchInner !== undefined;
    if (actualNullable !== expectedNullable) {
      issues.push(
        `${propertyPath}: Swift tri-state=${actualNullable}, OpenAPI nullable=${expectedNullable}`,
      );
      continue;
    }

    validateWireType(
      propertyPath,
      nonNullSchema(propertySchema, components),
      patchInner ?? optionalInner,
      components,
      overrides,
      swiftSource,
      issues,
      activeLocalTypes,
    );
  }
}

function validateWireType(
  path: string,
  schema: ContractSchema,
  swiftType: string,
  components: Record<string, ContractSchema>,
  overrides: Record<string, string>,
  swiftSource: string,
  issues: string[],
  activeLocalTypes: Set<string>,
): void {
  const normalized = normalizeSwiftType(swiftType);
  const referencedName = refName(schema);
  if (referencedName) {
    const expected =
      overrides[referencedName] ?? `Components.Schemas.${referencedName}`;
    if (normalized !== expected) {
      issues.push(`${path}: Swift type ${normalized}, OpenAPI ref ${expected}`);
    }
    return;
  }

  const primitive = expectedPrimitiveType(schema);
  if (primitive) {
    if (normalized !== primitive) {
      issues.push(`${path}: Swift type ${normalized}, OpenAPI type ${primitive}`);
    }
    return;
  }

  if (schema.type === "array") {
    const inner = arrayInner(normalized);
    if (!inner) {
      issues.push(`${path}: Swift type ${normalized}, OpenAPI type array`);
      return;
    }
    validateWireType(
      `${path}[]`,
      schema.items ?? {},
      inner,
      components,
      overrides,
      swiftSource,
      issues,
      activeLocalTypes,
    );
    return;
  }

  if (schema.type === "object" && schema.properties) {
    if (activeLocalTypes.has(normalized)) return;
    validateStructShape(
      path,
      schema,
      normalized,
      components,
      overrides,
      swiftSource,
      issues,
      new Set(activeLocalTypes).add(normalized),
    );
    return;
  }

  if (
    schema.type === "object" &&
    (schema.additionalProperties === true ||
      typeof schema.additionalProperties === "object")
  ) {
    if (normalized !== "OpenAPIObjectContainer") {
      issues.push(
        `${path}: Swift type ${normalized}, OpenAPI type OpenAPIObjectContainer`,
      );
    }
    return;
  }

  issues.push(`${path}: unsupported OpenAPI wire shape for Swift ${normalized}`);
}

export function validateSwiftPatchOverrides(
  components: Record<string, ContractSchema>,
  config: SwiftGeneratorConfig,
  swiftSource: string,
  clearableComponentNames: string[],
): string[] {
  const issues: string[] = [];
  const overrides = config.typeOverrides?.schemas ?? {};

  for (const componentName of [...clearableComponentNames].sort()) {
    const component = components[componentName];
    const swiftType = overrides[componentName];
    if (!component) {
      issues.push(`${componentName}: missing OpenAPI component`);
      continue;
    }
    if (!swiftType) {
      issues.push(`${componentName}: missing configured Swift override`);
      continue;
    }
    validateStructShape(
      componentName,
      component,
      swiftType,
      components,
      overrides,
      swiftSource,
      issues,
      new Set([swiftType]),
    );
    validateCustomCodecShape(
      componentName,
      component,
      swiftType,
      components,
      swiftSource,
      issues,
    );
  }

  return issues;
}
