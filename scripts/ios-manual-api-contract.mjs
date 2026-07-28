#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { parse as parseYaml } from "yaml";

const API_PREFIX = "/api/v1";
const METHODS = new Set(["get", "post", "patch", "delete", "put"]);

function normalizePath(path) {
  return path
    .replace(API_PREFIX, "")
    .replace(/\\\([^)]*\)/g, "{}")
    .replace(/\{[^}]+\}/g, "{}");
}

function firstRequestArguments(source, openParenIndex) {
  const args = [];
  let start = openParenIndex + 1;
  let parens = 0;
  let brackets = 0;
  let braces = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }
    if (char === '"') {
      inString = true;
    } else if (char === "(") {
      parens += 1;
    } else if (char === "[") {
      brackets += 1;
    } else if (char === "{") {
      braces += 1;
    } else if (char === ")") {
      if (parens === 0 && brackets === 0 && braces === 0) {
        args.push(source.slice(start, index).trim());
        return args;
      }
      parens -= 1;
    } else if (char === "]") {
      brackets -= 1;
    } else if (char === "}") {
      braces -= 1;
    } else if (
      char === "," &&
      parens === 0 &&
      brackets === 0 &&
      braces === 0
    ) {
      args.push(source.slice(start, index).trim());
      if (args.length === 2) return args;
      start = index + 1;
    }
  }
  return null;
}

function literalString(value) {
  const match = value?.match(/^"((?:\\.|[^"])*)"$/s);
  return match?.[1];
}

export function extractManualApiInventory(source) {
  const operations = [];
  const paths = [];
  const staticFailures = [];
  const seenPaths = new Set();

  const requestPattern = /\brequest\s*\(/g;
  for (const match of source.matchAll(requestPattern)) {
    const prefix = source.slice(Math.max(0, match.index - 24), match.index);
    if (/\bfunc\s*$/.test(prefix)) continue;
    const line = source.slice(0, match.index).split("\n").length;
    const openParenIndex = match.index + match[0].lastIndexOf("(");
    const args = firstRequestArguments(source, openParenIndex);
    if (!args || args.length < 2) {
      staticFailures.push(
        `request call at line ${line} could not be statically parsed`,
      );
      continue;
    }
    const method = literalString(args[0]);
    const path = literalString(args[1]);
    if (!method) {
      staticFailures.push(
        `request call at line ${line} must use a literal HTTP method`,
      );
    }
    if (!path) {
      staticFailures.push(
        `request call at line ${line} must use a literal path`,
      );
    }
    if (!method || !path || !path.startsWith(API_PREFIX)) continue;
    operations.push({
      method,
      path: normalizePath(path),
    });
  }

  const pathPattern = /"(\/api\/v1\/[^"]+)"/g;
  for (const match of source.matchAll(pathPattern)) {
    const path = normalizePath(match[1]);
    if (seenPaths.has(path)) continue;
    seenPaths.add(path);
    paths.push(path);
  }

  return { operations, paths, staticFailures };
}

export function validateManualApiContract(source, spec) {
  const inventory = extractManualApiInventory(source);
  const documented = new Map();
  for (const [path, item] of Object.entries(spec.paths ?? {})) {
    documented.set(normalizePath(path), item);
  }

  const failures = [...inventory.staticFailures];
  for (const path of inventory.paths) {
    if (!documented.has(path)) {
      failures.push(`${path} is not documented in api/openapi.yaml`);
    }
  }
  for (const { method, path } of inventory.operations) {
    const item = documented.get(path);
    const operation = item?.[method.toLowerCase()];
    if (!operation || !METHODS.has(method.toLowerCase())) {
      failures.push(
        `${method} ${path} is not documented in api/openapi.yaml`,
      );
    }
  }
  return [...new Set(failures)];
}

function main() {
  const root = resolve(import.meta.dirname, "..");
  const source = readFileSync(
    resolve(root, "ios/App/API/KairoAPI.swift"),
    "utf8",
  );
  const spec = parseYaml(
    readFileSync(resolve(root, "api/openapi.yaml"), "utf8"),
  );
  const inventory = extractManualApiInventory(source);
  const failures = validateManualApiContract(source, spec);
  if (failures.length > 0) {
    throw new Error(failures.join("\n"));
  }
  console.log(
    `Shipping iOS client contract is valid: ${inventory.operations.length} calls across ${inventory.paths.length} path shapes`,
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
