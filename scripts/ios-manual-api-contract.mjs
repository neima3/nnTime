#!/usr/bin/env node
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { relative, resolve } from "node:path";
import { parse as parseYaml } from "yaml";

const FACADE_PATH = "ios/App/API/KairoAPI.swift";

export const REQUIRED_GENERATED_OPERATIONS = Object.freeze([
  "getUserSettings",
  "updateUserSettings",
  "listCategories",
  "getDay",
  "createActivitySeries",
  "updateActivitySeries",
  "deleteActivitySeries",
  "listTasks",
  "createTask",
  "deleteTask",
  "search",
  "getStats",
  "createMoodCheckin",
  "listRoutines",
  "getActiveFocusSession",
  "startFocusSession",
  "updateFocusSession",
]);

function normalizedPath(path) {
  return path.replaceAll("\\", "/");
}

function walkSwiftFiles(directory) {
  return readdirSync(directory, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name))
    .flatMap((entry) => {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) return walkSwiftFiles(path);
      return entry.isFile() && entry.name.endsWith(".swift") ? [path] : [];
    });
}

export function collectShippingSwiftSources(appRoot) {
  const repositoryRoot = resolve(appRoot, "..", "..");
  return walkSwiftFiles(appRoot).map((path) => ({
    path: normalizedPath(relative(repositoryRoot, path)),
    source: readFileSync(path, "utf8"),
  }));
}

export function extractGeneratedOperationInventory(source) {
  const code = maskCommentsAndStrings(source);
  const operationIDs = [];
  const seen = new Set();
  for (const match of code.matchAll(
    /\bplanner\s*\.\s*([A-Za-z_][A-Za-z0-9_]*)\s*\(/g,
  )) {
    const operationID = match[1];
    if (seen.has(operationID)) continue;
    seen.add(operationID);
    operationIDs.push(operationID);
  }
  return operationIDs;
}

function maskCommentsAndStrings(source) {
  let result = "";
  let state = "code";
  let blockDepth = 0;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];

    if (state === "lineComment") {
      if (char === "\n") {
        state = "code";
        result += "\n";
      } else {
        result += " ";
      }
      continue;
    }

    if (state === "blockComment") {
      if (char === "/" && next === "*") {
        blockDepth += 1;
        result += "  ";
        index += 1;
      } else if (char === "*" && next === "/") {
        blockDepth -= 1;
        result += "  ";
        index += 1;
        if (blockDepth === 0) state = "code";
      } else {
        result += char === "\n" ? "\n" : " ";
      }
      continue;
    }

    if (state === "string") {
      if (char === "\\") {
        result += " ";
        if (next !== undefined) {
          result += next === "\n" ? "\n" : " ";
          index += 1;
        }
      } else if (char === '"') {
        state = "code";
        result += " ";
      } else {
        result += char === "\n" ? "\n" : " ";
      }
      continue;
    }

    if (char === "/" && next === "/") {
      state = "lineComment";
      result += "  ";
      index += 1;
    } else if (char === "/" && next === "*") {
      state = "blockComment";
      blockDepth = 1;
      result += "  ";
      index += 1;
    } else if (char === '"') {
      state = "string";
      result += " ";
    } else {
      result += char;
    }
  }

  return result;
}

function matchingBrace(source, openingIndex) {
  let depth = 0;
  for (let index = openingIndex; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] !== "}") continue;
    depth -= 1;
    if (depth === 0) return index;
  }
  return -1;
}

function authRequestRange(maskedSource) {
  const declaration =
    /\bfunc\s+authRequest(?:\s*<[^>{}]*>)?\s*\(/g.exec(maskedSource);
  if (!declaration) return null;
  const openingIndex = maskedSource.indexOf("{", declaration.index);
  if (openingIndex < 0) return null;
  const closingIndex = matchingBrace(maskedSource, openingIndex);
  if (closingIndex < 0) return null;
  return { start: declaration.index, end: closingIndex + 1 };
}

function isInside(index, range) {
  return range !== null && index >= range.start && index < range.end;
}

function containsManualTransportOutsideAuth(source, allowAuthRequest) {
  const masked = maskCommentsAndStrings(source);
  const allowedRange = allowAuthRequest ? authRequestRange(masked) : null;
  const patterns = [
    /\bURLRequest\s*\(/g,
    /\.\s*data\s*\(\s*for\s*:/g,
    /\bfunc\s+request(?:\s*<[^>{}]*>)?\s*\(/g,
    /(?<![.\w])request\s*\(/g,
  ];

  for (const pattern of patterns) {
    for (const match of masked.matchAll(pattern)) {
      if (!isInside(match.index, allowedRange)) return true;
    }
  }
  return false;
}

function documentedOperationIDs(spec) {
  const ids = new Set();
  for (const pathItem of Object.values(spec?.paths ?? {})) {
    for (const operation of Object.values(pathItem ?? {})) {
      if (
        operation &&
        typeof operation === "object" &&
        typeof operation.operationId === "string"
      ) {
        ids.add(operation.operationId);
      }
    }
  }
  return ids;
}

function appLinksGeneratedPackage(project) {
  const packagePath = project?.packages?.KairoAPIClient?.path;
  const dependencies = project?.targets?.Kairo?.dependencies;
  if (packagePath !== "Kairo" || !Array.isArray(dependencies)) return false;
  return dependencies.some(
    (dependency) =>
      dependency?.package === "KairoAPIClient" &&
      dependency?.product === "KairoAPIClient",
  );
}

export function validateGeneratedClientAdoption({ sources, spec, project }) {
  const failures = [];
  const facade = sources.find(
    ({ path }) => normalizedPath(path).endsWith(FACADE_PATH),
  );

  for (const file of sources) {
    const path = normalizedPath(file.path);
    if (file.source.includes("/api/v1")) {
      failures.push(`${path} contains a handwritten /api/v1 path`);
    }
    if (
      containsManualTransportOutsideAuth(
        file.source,
        path.endsWith(FACADE_PATH),
      )
    ) {
      failures.push(
        `${path} contains manual URLRequest transport outside KairoAPI.authRequest`,
      );
    }
    if (
      !path.endsWith(FACADE_PATH) &&
      extractGeneratedOperationInventory(file.source).length > 0
    ) {
      failures.push(
        `${path} invokes generated planner operations outside KairoAPI.swift`,
      );
    }
  }

  if (!facade) {
    failures.push("ios/App/API/KairoAPI.swift is missing");
  } else if (!/^\s*import\s+KairoAPIClient\s*$/m.test(facade.source)) {
    failures.push("KairoAPI.swift must import KairoAPIClient");
  }

  const operationIDs = facade
    ? extractGeneratedOperationInventory(facade.source)
    : [];
  const operationSet = new Set(operationIDs);
  for (const operationID of REQUIRED_GENERATED_OPERATIONS) {
    if (!operationSet.has(operationID)) {
      failures.push(
        `KairoAPI generated-operation inventory is missing ${operationID}`,
      );
    }
  }

  const documented = documentedOperationIDs(spec);
  for (const operationID of operationIDs) {
    if (!documented.has(operationID)) {
      failures.push(
        `KairoAPI generated operation ${operationID} is absent from api/openapi.yaml`,
      );
    }
  }

  if (!appLinksGeneratedPackage(project)) {
    failures.push(
      "ios/project.yml must link the KairoAPIClient product to the Kairo app target",
    );
  }

  return {
    failures: [...new Set(failures)],
    operationIDs,
  };
}

function main() {
  const root = resolve(import.meta.dirname, "..");
  const sources = collectShippingSwiftSources(resolve(root, "ios/App"));
  const spec = parseYaml(
    readFileSync(resolve(root, "api/openapi.yaml"), "utf8"),
  );
  const project = parseYaml(
    readFileSync(resolve(root, "ios/project.yml"), "utf8"),
  );
  const result = validateGeneratedClientAdoption({
    sources,
    spec,
    project,
  });
  if (result.failures.length > 0) {
    throw new Error(result.failures.join("\n"));
  }
  console.log(
    `Generated iOS client adoption is valid: ${result.operationIDs.length} operations across ${sources.length} shipping App Swift files`,
  );
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1])
) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
