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

function declarationRange(maskedSource, pattern) {
  const declaration = pattern.exec(maskedSource);
  if (!declaration) return null;
  const openingIndex = maskedSource.indexOf("{", declaration.index);
  if (openingIndex < 0) return null;
  const closingIndex = matchingBrace(maskedSource, openingIndex);
  if (closingIndex < 0) return null;
  return {
    start: declaration.index,
    bodyStart: openingIndex,
    end: closingIndex + 1,
  };
}

function isInside(index, range) {
  return range !== null && index >= range.start && index < range.end;
}

function authEndpointContract(source) {
  const masked = maskCommentsAndStrings(source);
  const enumRange = declarationRange(
    masked,
    /\bprivate\s+enum\s+AuthEndpoint\s*\{/g,
  );
  if (!enumRange) return { valid: false, range: null };

  const enumMasked = masked.slice(enumRange.start, enumRange.end);
  const enumSource = source.slice(enumRange.start, enumRange.end);
  const cases = [
    ...enumMasked.matchAll(
      /^\s*case\s+([A-Za-z_][A-Za-z0-9_]*)\s*$/gm,
    ),
  ].map((match) => match[1]);
  if (cases.length === 0 || new Set(cases).size !== cases.length) {
    return { valid: false, range: enumRange };
  }

  const propertyRange = declarationRange(
    enumMasked,
    /\bvar\s+pathComponents\s*:\s*\[\s*String\s*\]\s*\{/g,
  );
  if (!propertyRange) {
    return { valid: false, range: enumRange };
  }

  const propertyMasked = enumMasked.slice(
    propertyRange.start,
    propertyRange.end,
  );
  const propertySource = enumSource.slice(
    propertyRange.start,
    propertyRange.end,
  );
  if (!/\bswitch\s+self\s*\{/.test(propertyMasked)) {
    return { valid: false, range: enumRange };
  }
  if (/\bdefault\s*:/.test(propertyMasked)) {
    return { valid: false, range: enumRange };
  }

  const branchCases = [
    ...propertyMasked.matchAll(
      /\bcase\s+\.([A-Za-z_][A-Za-z0-9_]*)\s*:/g,
    ),
  ].map((match) => match[1]);
  if (
    branchCases.length !== cases.length ||
    new Set(branchCases).size !== branchCases.length ||
    branchCases.some((name) => !cases.includes(name))
  ) {
    return { valid: false, range: enumRange };
  }

  for (const name of cases) {
    const marker = `case .${name}:`;
    const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const branchPattern = new RegExp(
      `\\bcase\\s+\\.${escapedName}\\s*:\\s*\\[([^\\]]]*)\\]`,
    );
    let branch = branchPattern.exec(propertySource);
    if (!branch) {
      const markerIndex = propertySource.indexOf(marker);
      const arrayStart = propertySource.indexOf(
        "[",
        markerIndex + marker.length,
      );
      const arrayEnd = propertySource.indexOf("]", arrayStart + 1);
      if (markerIndex >= 0 && arrayStart >= 0 && arrayEnd > arrayStart) {
        branch = [
          propertySource.slice(markerIndex, arrayEnd + 1),
          propertySource.slice(arrayStart + 1, arrayEnd),
        ];
      }
    }
    const markerIndex = propertySource.indexOf(marker);
    const lineEnd = propertySource.indexOf("\n", markerIndex);
    const branchLine = propertySource
      .slice(markerIndex, lineEnd < 0 ? undefined : lineEnd)
      .trim();
    if (!branch || branchLine !== `${marker} [${branch[1]}]`) {
      return { valid: false, range: enumRange };
    }

    const arraySource = branch[1];
    const components = [
      ...arraySource.matchAll(/"([^"\\]*)"/g),
    ].map((match) => match[1]);
    const nonLiterals = arraySource
      .replace(/"[^"\\]*"/g, "")
      .replace(/[\s,]/g, "");
    if (
      nonLiterals.length > 0 ||
      components.length < 3 ||
      components[0] !== "api" ||
      components[1] !== "auth" ||
      components.some(
        (component) => !/^[A-Za-z0-9-]+$/.test(component),
      )
    ) {
      return { valid: false, range: enumRange };
    }
  }

  return { valid: true, range: enumRange };
}

const BENIGN_URL_SESSION_MEMBERS = new Set([
  "finishTasksAndInvalidate",
  "flush",
  "getAllTasks",
  "getTasksWithCompletionHandler",
  "invalidateAndCancel",
  "reset",
]);

function escapedPattern(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function urlSessionMemberCalls(source) {
  const masked = maskCommentsAndStrings(source);
  const sessionIdentifiers = new Set();

  for (const match of masked.matchAll(
    /\b([A-Za-z_][A-Za-z0-9_]*)\s*:\s*URLSession\b/g,
  )) {
    sessionIdentifiers.add(match[1]);
  }
  for (const match of masked.matchAll(
    /\b(?:let|var)\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*URLSession\s*(?:\.\s*shared\b|\()/g,
  )) {
    sessionIdentifiers.add(match[1]);
  }

  const calls = [];
  const directPatterns = [
    /\bURLSession\s*\.\s*shared\s*\.\s*([A-Za-z_][A-Za-z0-9_]*)\s*\(/g,
    /\bURLSession\s*\.\s*([A-Za-z_][A-Za-z0-9_]*)\s*\(/g,
  ];
  for (const pattern of directPatterns) {
    for (const match of masked.matchAll(pattern)) {
      calls.push({ index: match.index, member: match[1] });
    }
  }

  for (const identifier of sessionIdentifiers) {
    const pattern = new RegExp(
      `\\b${escapedPattern(identifier)}\\s*\\.\\s*([A-Za-z_][A-Za-z0-9_]*)\\s*\\(`,
      "g",
    );
    for (const match of masked.matchAll(pattern)) {
      calls.push({ index: match.index, member: match[1] });
    }
  }

  return [
    ...new Map(
      calls.map((call) => [`${call.index}:${call.member}`, call]),
    ).values(),
  ];
}

function authRequestContract(source, endpointContract) {
  if (!endpointContract.valid) return { valid: false, range: null };

  const masked = maskCommentsAndStrings(source);
  const range = declarationRange(
    masked,
    /\bprivate\s+func\s+authRequest(?:\s*<[^>{}]*>)?\s*\(/g,
  );
  if (!range) return { valid: false, range: null };

  const functionSource = masked.slice(range.start, range.end);
  const hasClosedSignature =
    /\bprivate\s+func\s+authRequest(?:\s*<[^>{}]*>)?\s*\(\s*_\s+endpoint\s*:\s*AuthEndpoint(?:\s*,|\s*\))/s.test(
      functionSource,
    );
  const safeURLBindings = [
    ...functionSource.matchAll(
      /\blet\s+url\s*=\s*endpoint\s*\.\s*pathComponents\s*\.\s*reduce\s*\(\s*baseURL\s*\)\s*\{\s*\$0\s*\.\s*appending\s*\(\s*path\s*:\s*\$1\s*\)\s*\}/g,
    ),
  ];
  const urlDeclarations = [
    ...functionSource.matchAll(/\b(?:let|var)\s+url\b/g),
  ];
  const urlAssignments = [
    ...functionSource.matchAll(/(?<![.\w])url\s*=(?!=)/g),
  ];
  const hasClosedURLBinding =
    safeURLBindings.length === 1 &&
    urlDeclarations.length === 1 &&
    urlAssignments.length === 1 &&
    !/(?<![.\w])url\s*\./.test(functionSource) &&
    !/&\s*url\b/.test(functionSource);
  const requestMatches = [
    ...functionSource.matchAll(/\bURLRequest\s*\(/g),
  ];
  const sessionMatches = urlSessionMemberCalls(source).filter((call) =>
    isInside(call.index, range),
  );
  const hasClosedTransport =
    requestMatches.length === 1 &&
    /\bURLRequest\s*\(\s*url\s*:\s*url\s*\)/.test(functionSource) &&
    sessionMatches.length === 1 &&
    sessionMatches[0].member === "data" &&
    /\bauthSession\s*\.\s*data\s*\(\s*for\s*:\s*request\s*\)/.test(
      functionSource,
    );

  return {
    valid:
      hasClosedSignature &&
      hasClosedURLBinding &&
      hasClosedTransport,
    range:
      hasClosedSignature &&
      hasClosedURLBinding &&
      hasClosedTransport
        ? range
        : null,
  };
}

function manualTransportOutsideRange(source, allowedRange) {
  const masked = maskCommentsAndStrings(source);
  const requestPatterns = [
    /\bURLRequest\s*\(/g,
    /\bfunc\s+request(?:\s*<[^>{}]*>)?\s*\(/g,
    /(?<![.\w])request\s*\(/g,
  ];

  let request = false;
  for (const pattern of requestPatterns) {
    for (const match of masked.matchAll(pattern)) {
      if (!isInside(match.index, allowedRange)) request = true;
    }
  }

  let session = false;
  for (const call of urlSessionMemberCalls(source)) {
    if (
      !BENIGN_URL_SESSION_MEMBERS.has(call.member) &&
      !isInside(call.index, allowedRange)
    ) {
      session = true;
    }
  }

  return { request, session };
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
  const endpointContract = facade
    ? authEndpointContract(facade.source)
    : { valid: false, range: null };
  const authContract = facade
    ? authRequestContract(facade.source, endpointContract)
    : { valid: false, range: null };

  for (const file of sources) {
    const path = normalizedPath(file.path);
    if (file.source.includes("/api/v1")) {
      failures.push(`${path} contains a handwritten /api/v1 path`);
    }
    const manualTransport = manualTransportOutsideRange(
      file.source,
      path.endsWith(FACADE_PATH) ? authContract.range : null,
    );
    if (manualTransport.request) {
      failures.push(
        `${path} contains manual URLRequest transport outside KairoAPI.authRequest`,
      );
    }
    if (manualTransport.session) {
      failures.push(
        `${path} contains manual URLSession transport outside KairoAPI.authRequest`,
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
  } else {
    if (!/^\s*import\s+KairoAPIClient\s*$/m.test(facade.source)) {
      failures.push("KairoAPI.swift must import KairoAPIClient");
    }
    if (!endpointContract.valid) {
      failures.push(
        "KairoAPI AuthEndpoint.pathComponents must contain only closed /api/auth/* paths",
      );
    } else if (!authContract.valid) {
      failures.push(
        "KairoAPI manual auth transport must use a closed AuthEndpoint-based authRequest boundary",
      );
    }
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
