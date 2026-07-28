interface ContractSchema {
  $ref?: string;
  anyOf?: ContractSchema[];
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

function structBody(source: string, typeName: string): string | undefined {
  const declaration = `public struct ${typeName}`;
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

function isOuterOptional(swiftType: string): boolean {
  return swiftType.endsWith("?");
}

function isPatchField(swiftType: string): boolean {
  const withoutOuterOptional = swiftType.endsWith("?")
    ? swiftType.slice(0, -1)
    : swiftType;
  return withoutOuterOptional.startsWith("PatchField<");
}

export function validateSwiftPatchOverrides(
  components: Record<string, ContractSchema>,
  config: SwiftGeneratorConfig,
  swiftSource: string,
): string[] {
  const issues: string[] = [];
  const overrides = Object.entries(config.typeOverrides?.schemas ?? {}).filter(
    ([componentName, swiftType]) =>
      Boolean(components[componentName]?.properties) && !swiftType.includes("."),
  );

  for (const [componentName, swiftType] of overrides) {
    const component = components[componentName]!;
    const expectedProperties = component.properties ?? {};
    const actualProperties = swiftProperties(swiftSource, swiftType);
    if (!actualProperties) {
      issues.push(`${componentName}: missing public struct ${swiftType}`);
      continue;
    }

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

    const required = new Set(component.required ?? []);
    for (const propertyName of expectedNames) {
      const propertySchema = expectedProperties[propertyName]!;
      const swiftPropertyType = actualProperties[propertyName];
      if (!swiftPropertyType) continue;

      const expectedOptional = !required.has(propertyName);
      const expectedNullable = isNullable(propertySchema, components);
      const actualOptional = isOuterOptional(swiftPropertyType);
      const actualNullable = isPatchField(swiftPropertyType);
      if (actualOptional !== expectedOptional) {
        issues.push(
          `${componentName}.${propertyName}: Swift optional=${actualOptional}, OpenAPI optional=${expectedOptional}`,
        );
      }
      if (actualNullable !== expectedNullable) {
        issues.push(
          `${componentName}.${propertyName}: Swift tri-state=${actualNullable}, OpenAPI nullable=${expectedNullable}`,
        );
      }
    }
  }

  return issues;
}
