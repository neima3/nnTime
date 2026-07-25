/**
 * Migration-chain guards.
 *
 * Written after a silent production-class bug: 0006/0007 referenced a "users"
 * table that does not exist in this schema, so every from-scratch migration
 * (fresh Coolify DB, staging, local dev) died at 0006 — leaving those
 * environments without a working push_subscriptions table. Two layers hid it:
 * the runtime migration runner catches errors and exits 0, and the DB test
 * harness treated the same failure as "no Postgres available" and skipped.
 *
 * These are static checks (no DB required) so they run everywhere, including CI
 * without a Postgres service. The live from-scratch assertion lives in
 * migrations.test.ts, which now rethrows MigrationFailure instead of skipping.
 */
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const drizzleDir = resolve(process.cwd(), "drizzle");
const files = readdirSync(drizzleDir)
  .filter((f) => /^\d{4}_.*\.sql$/.test(f))
  .sort();
const sources = new Map(files.map((f) => [f, readFileSync(resolve(drizzleDir, f), "utf8")]));

/** Strip `--` comments so prose about the bug doesn't trip the checks. */
function statementsOnly(sql: string): string {
  return sql
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n");
}

describe("migration chain", () => {
  it("has migrations to check", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it("is numbered without gaps or duplicates", () => {
    const numbers = files.map((f) => Number(f.slice(0, 4)));
    expect(numbers).toEqual([...numbers].sort((a, b) => a - b));
    expect(new Set(numbers).size).toBe(numbers.length);
    numbers.forEach((n, i) => expect(n).toBe(i));
  });

  it("never references a \"users\" table — the auth table is \"user\"", () => {
    for (const [file, sql] of sources) {
      const body = statementsOnly(sql);
      expect(body, `${file} references a non-existent "users" table`).not.toMatch(
        /"users"|\busers\s*\(/i,
      );
    }
  });

  it("only references tables some earlier migration creates", () => {
    const created = new Set<string>();
    for (const file of files) {
      const body = statementsOnly(sources.get(file)!);
      for (const m of body.matchAll(/CREATE TABLE(?:\s+IF NOT EXISTS)?\s+"?([a-z_]+)"?/gi)) {
        created.add(m[1].toLowerCase());
      }
      for (const m of body.matchAll(/REFERENCES\s+(?:"public"\.)?"?([a-z_]+)"?\s*\(/gi)) {
        const target = m[1].toLowerCase();
        expect(
          created.has(target),
          `${file} has a FK to "${target}", which no migration up to here creates`,
        ).toBe(true);
      }
    }
  });

  it("keeps the superseded push-subscription rebuilds inert", () => {
    // 0008 is the correct rebuild; 0006/0007 must stay no-ops so the chain
    // reaches it on a fresh database.
    for (const file of ["0006_rebuild_push_subs.sql", "0007_push_subs_doblock.sql"]) {
      const body = statementsOnly(sources.get(file)!).trim();
      expect(body, `${file} should be a no-op`).toBe("SELECT 1;");
    }
    expect(statementsOnly(sources.get("0008_push_subs_fk_fix.sql")!)).toMatch(
      /REFERENCES "user"\("id"\)/,
    );
  });
});
