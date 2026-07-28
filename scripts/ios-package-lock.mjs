import {
  lstatSync,
  mkdirSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { randomUUID } from "node:crypto";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

function validatePackageLock(contents, sourcePath) {
  let lock;
  try {
    lock = JSON.parse(contents);
  } catch (error) {
    throw new Error(`${sourcePath} is not valid JSON: ${error.message}`);
  }

  if (lock.version !== 3 || !Array.isArray(lock.pins) || lock.pins.length === 0) {
    throw new Error(`${sourcePath} must contain a non-empty version 3 package graph`);
  }

  for (const pin of lock.pins) {
    if (
      typeof pin.identity !== "string" ||
      typeof pin.state?.revision !== "string" ||
      !/^[0-9a-f]{40}$/.test(pin.state.revision) ||
      typeof pin.state?.version !== "string"
    ) {
      throw new Error(
        `${sourcePath} must pin every package to an exact version and revision`,
      );
    }
  }
}

export function installPackageLock(sourcePath, destinationPath) {
  const authoritative = readFileSync(sourcePath);
  validatePackageLock(authoritative.toString("utf8"), sourcePath);

  try {
    if (
      lstatSync(destinationPath).isFile() &&
      readFileSync(destinationPath).equals(authoritative)
    ) {
      return "unchanged";
    }
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }

  mkdirSync(dirname(destinationPath), { recursive: true });
  const temporaryPath = join(
    dirname(destinationPath),
    `.${basename(destinationPath)}.${process.pid}.${randomUUID()}.tmp`,
  );

  try {
    writeFileSync(temporaryPath, authoritative, {
      flag: "wx",
      mode: statSync(sourcePath).mode & 0o777,
    });
    renameSync(temporaryPath, destinationPath);
  } catch (error) {
    try {
      unlinkSync(temporaryPath);
    } catch (cleanupError) {
      if (cleanupError.code !== "ENOENT") {
        throw new AggregateError(
          [error, cleanupError],
          `Failed to install ${destinationPath} and clean up ${temporaryPath}`,
        );
      }
    }
    throw error;
  }

  return "updated";
}

const scriptPath = process.argv[1] ? resolve(process.argv[1]) : "";
if (scriptPath === fileURLToPath(import.meta.url)) {
  const [command, sourcePath, destinationPath] = process.argv.slice(2);
  if (command !== "install" || !sourcePath || !destinationPath) {
    console.error(
      "Usage: node scripts/ios-package-lock.mjs install SOURCE DESTINATION",
    );
    process.exit(64);
  }

  const result = installPackageLock(resolve(sourcePath), resolve(destinationPath));
  console.log(`iOS package lock: ${result}`);
}
