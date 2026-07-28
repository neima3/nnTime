#!/usr/bin/env node
import {
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { randomUUID } from "node:crypto";

const REPO_ROOT = resolve(import.meta.dirname, "..");
const DEFAULT_CANONICAL = resolve(REPO_ROOT, "api/openapi.yaml");
const DEFAULT_NATIVE = resolve(
  REPO_ROOT,
  "ios/Kairo/Sources/Kairo/openapi.yaml",
);

function usageError(message) {
  throw new Error(
    `${message}\nUsage: node scripts/sync-ios-openapi.mjs [--check] [canonical-path native-path]`,
  );
}

function parseArgs(args) {
  const check = args[0] === "--check";
  const paths = check ? args.slice(1) : args;
  if (paths.some((arg) => arg.startsWith("--"))) {
    usageError(`Unknown option: ${paths.find((arg) => arg.startsWith("--"))}`);
  }
  if (paths.length !== 0 && paths.length !== 2) {
    usageError("Provide both canonical and native paths, or neither.");
  }
  return {
    check,
    canonicalPath: resolve(paths[0] ?? DEFAULT_CANONICAL),
    nativePath: resolve(paths[1] ?? DEFAULT_NATIVE),
  };
}

function main() {
  const { check, canonicalPath, nativePath } = parseArgs(process.argv.slice(2));
  const canonical = readFileSync(canonicalPath);
  let native;
  try {
    native = readFileSync(nativePath);
  } catch (error) {
    if (check) throw error;
    native = null;
  }

  if (native?.equals(canonical)) {
    console.log(`OpenAPI contracts are in sync: ${nativePath}`);
    return;
  }

  if (check) {
    throw new Error(
      `iOS OpenAPI copy is stale: ${nativePath}\nRun: pnpm api:sync-ios`,
    );
  }

  const tempPath = resolve(
    dirname(nativePath),
    `.${randomUUID()}.openapi.tmp`,
  );
  try {
    writeFileSync(tempPath, canonical);
    renameSync(tempPath, nativePath);
  } finally {
    try {
      unlinkSync(tempPath);
    } catch {
      // rename removed the temporary path.
    }
  }
  console.log(`Synchronized ${canonicalPath} -> ${nativePath}`);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
