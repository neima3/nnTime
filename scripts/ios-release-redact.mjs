#!/usr/bin/env node

import { readFileSync } from "node:fs";

const secrets = [
  process.env.KAIRO_ASC_KEY_ID,
  process.env.KAIRO_ASC_ISSUER_ID,
  process.env.KAIRO_ASC_KEY_PATH,
]
  .filter(Boolean)
  .sort((left, right) => right.length - left.length);
function redact(value) {
  return secrets.reduce(
    (output, secret) => output.replaceAll(secret, "<redacted>"),
    value,
  );
}

process.stdout.write(redact(readFileSync(0, "utf8")));
