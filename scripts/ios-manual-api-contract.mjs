#!/usr/bin/env node
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { relative, resolve } from "node:path";
import { parse as parseYaml } from "yaml";

const FACADE_PATH = "ios/App/API/KairoAPI.swift";

export const REQUIRED_GENERATED_OPERATIONS = Object.freeze([
  "getAuthCapabilities",
  "createAppleAuthChallenge",
  "exchangeAppleCredential",
  "getUserSettings",
  "updateUserSettings",
  "listCategories",
  "getDay",
  "getActivitySeries",
  "getChanges",
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

function normalizedTypeName(type) {
  return type.replace(/\s/g, "").replace(/[!?]+$/, "");
}

function isURLSessionType(type, aliases) {
  const normalized = normalizedTypeName(type);
  return (
    normalized === "URLSession" ||
    normalized === "Foundation.URLSession" ||
    aliases.has(normalized)
  );
}

function isSessionLikeIdentifier(identifier) {
  return /session$/i.test(identifier) || /^session/i.test(identifier);
}

function localAliasIdentifier(initializer) {
  return /^(?:(?:self|Self)\s*\.\s*)?([A-Za-z_][A-Za-z0-9_]*)$/.exec(
    initializer,
  )?.[1];
}

function isProvenNonNetworkInitializer(initializer) {
  const nominalConstructor =
    /^(?:[A-Za-z_][A-Za-z0-9_]*\s*\.\s*)*([A-Z][A-Za-z0-9_]*)\s*\(/.exec(
      initializer,
    );
  if (
    nominalConstructor &&
    nominalConstructor[1] !== "URLSession"
  ) {
    return true;
  }
  return /^AVAudioSession\s*\.\s*sharedInstance\s*\(/.test(
    initializer,
  );
}

function urlSessionProvenance(source) {
  const masked = maskCommentsAndStrings(source);
  const sessionIdentifiers = new Set();
  const factoryNames = new Set();
  const bindings = [];
  const aliasDefinitions = new Map();
  const urlSessionAliases = new Set();

  for (const match of masked.matchAll(
    /\btypealias\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*((?:Foundation\s*\.\s*)?[A-Za-z_][A-Za-z0-9_]*[!?]?)/g,
  )) {
    aliasDefinitions.set(match[1], normalizedTypeName(match[2]));
  }
  let aliasesChanged = true;
  while (aliasesChanged) {
    aliasesChanged = false;
    for (const [name, target] of aliasDefinitions) {
      if (
        !urlSessionAliases.has(name) &&
        (target === "URLSession" ||
          target === "Foundation.URLSession" ||
          urlSessionAliases.has(target))
      ) {
        urlSessionAliases.add(name);
        aliasesChanged = true;
      }
    }
  }

  for (const match of masked.matchAll(
    /\b([A-Za-z_][A-Za-z0-9_]*)\s*:\s*((?:Foundation\s*\.\s*)?[A-Za-z_][A-Za-z0-9_]*[!?]?)/g,
  )) {
    if (isURLSessionType(match[2], urlSessionAliases)) {
      sessionIdentifiers.add(match[1]);
    }
  }

  for (const match of masked.matchAll(
    /\bfunc\s+([A-Za-z_][A-Za-z0-9_]*)(?:\s*<[^>{}]*>)?\s*\([^)]*\)\s*(?:async\s*)?(?:throws\s*)?->\s*((?:Foundation\s*\.\s*)?[A-Za-z_][A-Za-z0-9_]*[!?]?)/g,
  )) {
    if (isURLSessionType(match[2], urlSessionAliases)) {
      factoryNames.add(match[1]);
    }
  }

  for (const match of masked.matchAll(
    /\b(?:let|var)\s+([A-Za-z_][A-Za-z0-9_]*)\s*(?::\s*([^=\n]+?))?\s*=\s*([^\n;]+)/g,
  )) {
    bindings.push({
      name: match[1],
      type: match[2]?.trim() ?? null,
      initializer: match[3].trim(),
    });
  }

  for (const binding of bindings) {
    if (
      binding.type &&
      isURLSessionType(binding.type, urlSessionAliases)
    ) {
      sessionIdentifiers.add(binding.name);
      continue;
    }
    if (
      /^(?:Foundation\s*\.\s*)?URLSession\s*(?:\.\s*shared\b|\()/.test(
        binding.initializer,
      )
    ) {
      sessionIdentifiers.add(binding.name);
      continue;
    }
    const factoryCall =
      /^(?:(?:Self|[A-Za-z_][A-Za-z0-9_]*)\s*\.\s*)?([A-Za-z_][A-Za-z0-9_]*)\s*\(/.exec(
        binding.initializer,
      );
    if (factoryCall && factoryNames.has(factoryCall[1])) {
      sessionIdentifiers.add(binding.name);
    }
  }

  let changed = true;
  while (changed) {
    changed = false;
    for (const binding of bindings) {
      if (sessionIdentifiers.has(binding.name)) continue;
      const alias = localAliasIdentifier(binding.initializer);
      if (alias && sessionIdentifiers.has(alias)) {
        sessionIdentifiers.add(binding.name);
        changed = true;
      }
    }
  }

  const ambiguousBindings = bindings
    .filter((binding) => {
      if (sessionIdentifiers.has(binding.name) || binding.type) {
        return false;
      }
      if (isProvenNonNetworkInitializer(binding.initializer)) {
        return false;
      }
      const alias = localAliasIdentifier(binding.initializer);
      const sessionLikeInitializer =
        (alias && isSessionLikeIdentifier(alias)) ||
        /\b[A-Za-z_][A-Za-z0-9_]*Session\s*\(/i.test(
          binding.initializer,
        );
      return (
        isSessionLikeIdentifier(binding.name) ||
        sessionLikeInitializer
      );
    })
    .map((binding) => binding.name);

  return { ambiguousBindings, masked, sessionIdentifiers };
}

function urlSessionAnalysis(source) {
  const provenance = urlSessionProvenance(source);
  const { masked, sessionIdentifiers } = provenance;
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
      `\\b${escapedPattern(identifier)}\\s*[?!]?\\s*\\.\\s*([A-Za-z_][A-Za-z0-9_]*)\\s*\\(`,
      "g",
    );
    for (const match of masked.matchAll(pattern)) {
      calls.push({ index: match.index, member: match[1] });
    }
  }

  return {
    ambiguousBindings: provenance.ambiguousBindings,
    calls: [
      ...new Map(
        calls.map((call) => [`${call.index}:${call.member}`, call]),
      ).values(),
    ],
  };
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
  const originalFunctionSource = source.slice(range.start, range.end);
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
  const safeRequestBindings = [
    ...functionSource.matchAll(
      /\bvar\s+request\s*=\s*URLRequest\s*\(\s*url\s*:\s*url\s*\)/g,
    ),
  ];
  const requestDeclarations = [
    ...functionSource.matchAll(/\b(?:let|var)\s+request\b/g),
  ];
  const requestAssignments = [
    ...functionSource.matchAll(/(?<![.\w])request\s*=(?!=)/g),
  ];
  const requestMemberMatches = [
    ...functionSource.matchAll(
      /\brequest\s*\.\s*([A-Za-z_][A-Za-z0-9_]*)/g,
    ),
  ];
  const allowedRequestMember = (match) => {
    const operation = originalFunctionSource.slice(match.index);
    if (match[1] === "httpMethod") {
      return /^request\s*\.\s*httpMethod\s*=\s*"POST"[ \t]*(?:\r?\n|$)/.test(
        operation,
      );
    }
    if (match[1] === "httpBody") {
      return /^request\s*\.\s*httpBody\s*=\s*try\s+JSONEncoder\s*\(\s*\)\s*\.\s*encode\s*\(\s*body\s*\)[ \t]*(?:\r?\n|$)/.test(
        operation,
      );
    }
    if (match[1] === "setValue") {
      return /^request\s*\.\s*setValue\s*\(\s*"application\/json"\s*,\s*forHTTPHeaderField\s*:\s*"Content-Type"\s*\)[ \t]*(?:\r?\n|$)/s.test(
        operation,
      );
    }
    return false;
  };
  const requestMembers = requestMemberMatches.map((match) => match[1]);
  const hasFixedRequestSetup =
    safeRequestBindings.length === 1 &&
    requestDeclarations.length === 1 &&
    requestAssignments.length === 1 &&
    requestMembers.length === 3 &&
    requestMembers.filter((member) => member === "httpMethod")
      .length === 1 &&
    requestMembers.filter((member) => member === "httpBody").length ===
      1 &&
    requestMembers.filter((member) => member === "setValue").length ===
      1 &&
    requestMemberMatches.every(allowedRequestMember) &&
    !/\brequest\s*\.\s*url\b/.test(functionSource) &&
    !/&\s*request\b/.test(functionSource);
  const sessionMatches = urlSessionAnalysis(source).calls.filter(
    (call) => isInside(call.index, range),
  );
  const hasClosedTransport =
    requestMatches.length === 1 &&
    hasFixedRequestSetup &&
    ((sessionMatches.length === 1 &&
      sessionMatches[0].member === "data" &&
      /\bauthSession\s*\.\s*data\s*\(\s*for\s*:\s*request\s*\)/.test(
        functionSource,
      )) ||
      (sessionMatches.length === 0 &&
        /\bauthData\s*\(\s*for\s*:\s*request\s*\)/.test(functionSource)));

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

function namedFunctionRange(source, name) {
  return declarationRange(
    maskCommentsAndStrings(source),
    new RegExp(
      `\\b(?:nonisolated\\s+)?(?:static\\s+)?(?:private\\s+)?func\\s+${escapedPattern(name)}(?:\\s*<[^>{}]*>)?\\s*\\(`,
      "g",
    ),
  );
}

function extendedAuthTransportContract(source) {
  const masked = maskCommentsAndStrings(source);
  const authDataRange = namedFunctionRange(source, "authData");
  const magicLinkRange = namedFunctionRange(source, "magicLinkRequest");
  const redeemRange = namedFunctionRange(source, "redeemMagicLink");
  const declaresExtendedBoundary =
    authDataRange !== null || magicLinkRange !== null || redeemRange !== null;
  if (!declaresExtendedBoundary) {
    return { valid: true, ranges: [] };
  }
  if (!authDataRange || !magicLinkRange || !redeemRange) {
    return { valid: false, ranges: [] };
  }

  const authData = masked.slice(authDataRange.start, authDataRange.end);
  const authDataCalls = urlSessionAnalysis(source).calls.filter((call) =>
    isInside(call.index, authDataRange),
  );
  const authDataValid =
    /\bprivate\s+func\s+authData\s*\(\s*for\s+request\s*:\s*URLRequest\s*\)\s*async\s+throws\s*->\s*Data\s*\{/s.test(
      authData,
    ) &&
    authDataCalls.length === 1 &&
    authDataCalls[0].member === "data" &&
    /\bauthSession\s*\.\s*data\s*\(\s*for\s*:\s*request\s*\)/.test(
      authData,
    );

  const magicLink = source.slice(magicLinkRange.start, magicLinkRange.end);
  const magicLinkMasked = masked.slice(
    magicLinkRange.start,
    magicLinkRange.end,
  );
  const magicLinkValid =
    /\bnonisolated\s+static\s+func\s+magicLinkRequest\s*\(\s*baseURL\s*:\s*URL\s*,\s*email\s*:\s*String\s*\)\s*throws\s*->\s*URLRequest\s*\{/s.test(
      magicLinkMasked,
    ) &&
    magicLink.includes(
      '["api", "auth", "sign-in", "magic-link"].reduce(baseURL)',
    ) &&
    (magicLinkMasked.match(/\bURLRequest\s*\(/g) ?? []).length === 1 &&
    /request\s*\.\s*httpMethod\s*=\s*"POST"/.test(magicLink) &&
    /metadata\s*:\s*\.init\s*\(\s*platform\s*:\s*"ios"\s*\)/s.test(
      magicLink,
    );

  const redeem = source.slice(redeemRange.start, redeemRange.end);
  const redeemMasked = masked.slice(redeemRange.start, redeemRange.end);
  const redeemValid =
    /\bfunc\s+redeemMagicLink\s*\(\s*token\s*:\s*String\s*\)\s*async\s+throws\s*->\s*NativeSessionController\s*\.\s*PersistResult\s*\{/s.test(
      redeemMasked,
    ) &&
    redeem.includes(
      '["api", "auth", "magic-link", "verify"].reduce(baseURL)',
    ) &&
    /URLQueryItem\s*\(\s*name\s*:\s*"token"\s*,\s*value\s*:\s*token\s*\)/s.test(
      redeem,
    ) &&
    (redeemMasked.match(/\bURLRequest\s*\(/g) ?? []).length === 1 &&
    /request\s*\.\s*httpMethod\s*=\s*"GET"/.test(redeem) &&
    /\bauthData\s*\(\s*for\s*:\s*request\s*\)/.test(redeemMasked);

  return {
    valid: authDataValid && magicLinkValid && redeemValid,
    ranges:
      authDataValid && magicLinkValid && redeemValid
        ? [authDataRange, magicLinkRange, redeemRange]
        : [],
  };
}

function isInsideAny(index, ranges) {
  return ranges.some((range) => isInside(index, range));
}

function manualTransportOutsideRanges(source, allowedRanges) {
  const masked = maskCommentsAndStrings(source);
  const sessionAnalysis = urlSessionAnalysis(source);
  const requestOffenses = [];
  for (const match of masked.matchAll(/\bURLRequest\s*\(/g)) {
    if (!isInsideAny(match.index, allowedRanges)) {
      requestOffenses.push({ index: match.index, symbol: "URLRequest" });
    }
  }

  const sessionOffenses = [];
  for (const call of sessionAnalysis.calls) {
    if (
      !BENIGN_URL_SESSION_MEMBERS.has(call.member) &&
      !isInsideAny(call.index, allowedRanges)
    ) {
      sessionOffenses.push(call);
    }
  }

  return {
    ambiguousSession: sessionAnalysis.ambiguousBindings.length > 0,
    request: requestOffenses.length > 0,
    requestOffenses,
    session: sessionOffenses.length > 0,
    sessionOffenses,
  };
}

function sourceLine(source, index) {
  return source.slice(0, index).split("\n").length;
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
  const extendedAuthContract = facade
    ? extendedAuthTransportContract(facade.source)
    : { valid: false, ranges: [] };

  for (const file of sources) {
    const path = normalizedPath(file.path);
    if (file.source.includes("/api/v1")) {
      failures.push(`${path} contains a handwritten /api/v1 path`);
    }
    const allowedRanges =
      path.endsWith(FACADE_PATH) &&
      authContract.range &&
      extendedAuthContract.valid
        ? [authContract.range, ...extendedAuthContract.ranges]
        : [];
    const manualTransport = manualTransportOutsideRanges(
      file.source,
      allowedRanges,
    );
    if (manualTransport.request) {
      failures.push(
        `${path} contains manual URLRequest transport outside KairoAPI.authRequest`,
      );
      for (const offense of manualTransport.requestOffenses) {
        failures.push(
          `${path}:${sourceLine(file.source, offense.index)} contains manual URLRequest transport via ${offense.symbol} outside KairoAPI.authRequest`,
        );
      }
    }
    if (manualTransport.session) {
      failures.push(
        `${path} contains manual URLSession transport outside KairoAPI.authRequest`,
      );
      for (const offense of manualTransport.sessionOffenses) {
        failures.push(
          `${path}:${sourceLine(file.source, offense.index)} contains manual URLSession transport via URLSession.${offense.member} outside KairoAPI.authRequest`,
        );
      }
    }
    if (manualTransport.ambiguousSession) {
      failures.push(
        `${path} contains an ambiguous session-like binding without an explicit non-network type`,
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
    } else if (!extendedAuthContract.valid) {
      failures.push(
        "KairoAPI native magic-link transport must use the closed authData and callback-request boundaries",
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
