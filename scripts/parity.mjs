#!/usr/bin/env node
// Parses the markdown table in docs/plans/parity-checklist.md and computes
// web / iOS / combined parity percentages per the roadmap's "Parity scoring"
// rules. No dependencies. Exit code 1 if the table is malformed.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CHECKLIST_PATH = path.resolve(__dirname, "../docs/plans/parity-checklist.md");

const STATUS_CREDIT = {
  planned: 1,
  partial: 0.5,
  deferred: 0,
  excluded: 0,
};
const VALID_PLATFORMS = new Set(["web", "ios", "both"]);
const ID_RE = /^[A-N]\d{2}$/;

function fail(msg) {
  console.error(`Malformed parity table: ${msg}`);
  process.exit(1);
}

function parseTable(markdown) {
  const lines = markdown.split("\n");
  const rows = [];
  let inTable = false;
  let sawHeader = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line.startsWith("|")) {
      continue;
    }
    const cells = line
      .split("|")
      .slice(1, -1)
      .map((c) => c.trim());

    // Header row: first cell literally "id"
    if (cells[0] && cells[0].toLowerCase() === "id") {
      inTable = true;
      sawHeader = true;
      continue;
    }
    // Separator row: all cells are dashes (---)
    if (inTable && cells.every((c) => /^:?-+:?$/.test(c))) {
      continue;
    }
    if (!inTable) {
      continue;
    }
    // Any other row inside the table region is a data row
    if (cells.length !== 8) {
      fail(`row does not have 8 columns: "${line}"`);
    }
    const [id, feature, area, platforms, phase, status, creditStr, reason] = cells;
    rows.push({ id, feature, area, platforms, phase, status, creditStr, reason, raw: line });
  }

  if (!sawHeader) {
    fail("no table header row found (expected a row starting with '| id |')");
  }
  if (rows.length === 0) {
    fail("no data rows found");
  }
  return rows;
}

function validate(rows) {
  const seenIds = new Set();
  for (const row of rows) {
    if (!ID_RE.test(row.id)) {
      fail(`bad id "${row.id}" (expected area letter A-N + 2 digits) in row: ${row.raw}`);
    }
    if (seenIds.has(row.id)) {
      fail(`duplicate id "${row.id}"`);
    }
    seenIds.add(row.id);

    if (!VALID_PLATFORMS.has(row.platforms)) {
      fail(`bad platforms "${row.platforms}" for id ${row.id} (expected web/ios/both)`);
    }
    if (!(row.status in STATUS_CREDIT)) {
      fail(
        `bad status "${row.status}" for id ${row.id} (expected planned/partial/deferred/excluded)`
      );
    }
    const credit = Number(row.creditStr);
    if (Number.isNaN(credit)) {
      fail(`bad credit "${row.creditStr}" for id ${row.id} (not a number)`);
    }
    const expected = STATUS_CREDIT[row.status];
    if (credit !== expected) {
      fail(
        `credit/status mismatch for id ${row.id}: status "${row.status}" requires credit ${expected}, found ${credit}`
      );
    }
    if (row.status === "partial" && (!row.reason || row.reason === "—" || row.reason.trim() === "")) {
      fail(`id ${row.id} is "partial" but has no written acceptance criteria in the last column`);
    }
    if (row.status === "excluded" && (!row.reason || row.reason === "—" || row.reason.trim() === "")) {
      fail(`id ${row.id} is "excluded" but has no written reason in the last column`);
    }
    row.credit = credit;
  }
}

function pct(numerator, denominator) {
  if (denominator === 0) return 0;
  return (numerator / denominator) * 100;
}

function computeSlice(rows, platformsAllowed) {
  const included = rows.filter(
    (r) => r.status !== "excluded" && platformsAllowed.has(r.platforms)
  );
  const creditSum = included.reduce((sum, r) => sum + r.credit, 0);
  return { rows: included, creditSum, pct: pct(creditSum, included.length) };
}

function main() {
  const markdown = readFileSync(CHECKLIST_PATH, "utf8");
  const rows = parseTable(markdown);
  validate(rows);

  const web = computeSlice(rows, new Set(["web", "both"]));
  const ios = computeSlice(rows, new Set(["ios", "both"]));
  const combined = computeSlice(rows, new Set(["web", "ios", "both"]));

  const statusCounts = {};
  for (const r of rows) {
    statusCounts[r.status] = (statusCounts[r.status] || 0) + 1;
  }

  console.log(`Total inventory rows: ${rows.length}`);
  console.log("");
  console.log("Counts per status:");
  for (const status of Object.keys(STATUS_CREDIT)) {
    console.log(`  ${status.padEnd(10)} ${statusCounts[status] || 0}`);
  }
  console.log("");
  console.log(
    `Web parity:      ${web.creditSum.toFixed(1)} / ${web.rows.length} = ${web.pct.toFixed(2)}%`
  );
  console.log(
    `iOS parity:      ${ios.creditSum.toFixed(1)} / ${ios.rows.length} = ${ios.pct.toFixed(2)}%`
  );
  console.log(
    `Combined parity: ${combined.creditSum.toFixed(1)} / ${combined.rows.length} = ${combined.pct.toFixed(2)}%`
  );
  console.log("");
  const gate = 85;
  for (const [label, slice] of [
    ["Web", web],
    ["iOS", ios],
  ]) {
    console.log(
      `${label} vs ${gate}% gate: ${slice.pct >= gate ? "PASS" : "FAIL"} (${slice.pct.toFixed(2)}%)`
    );
  }
}

main();
