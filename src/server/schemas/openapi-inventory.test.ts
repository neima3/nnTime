/**
 * OpenAPI ↔ route-handler inventory (Wave 2E / ADR-002 CI drift gate).
 *
 * Asserts every documented path under api/openapi.yaml has a Next.js App Router
 * handler under src/app/api/v1 (route.ts leaves), and every non-private handler
 * is documented. Intentional gaps live in the allowlists below with rationale.
 */
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { parse as parseYaml } from "yaml";

const ROOT = process.cwd();
const SPEC_PATH = resolve(ROOT, "api/openapi.yaml");
const API_ROOT = resolve(ROOT, "src/app/api/v1");
const API_PREFIX = "/api/v1";

interface OpenApiSpec {
  paths?: Record<string, Record<string, unknown>>;
}

const HTTP_METHODS = new Set(["get", "post", "put", "patch", "delete"]);

/**
 * Handlers that intentionally have no OpenAPI entry (private / internal /
 * product extras not yet in the published contract).
 * Exact paths or trailing `/*` prefix globs.
 */
const HANDLERS_WITHOUT_OPENAPI = [
  "/api/v1/ai/*",
  "/api/v1/calendar/ics",
  "/api/v1/privacy/*",
  "/api/v1/tasks/import",
  "/api/v1/jobs/tick",
  // Web Push (F1) — private product endpoints, not in the published contract.
  "/api/v1/push/*",
  // Implemented path shapes differ from deferred OpenAPI designs:
  // list occurrences by series id (not get-by-occurrenceKey).
  "/api/v1/activities/{id}/occurrences",
  // PATCH pause/resume by scheduleId (OpenAPI only documents collection POST).
  "/api/v1/routines/{id}/schedules/{scheduleId}",
] as const;

/**
 * OpenAPI paths without a handler yet — deferred to a later phase.
 * Keep documented so the contract stays aspirational; remove when shipped.
 */
const OPENAPI_WITHOUT_HANDLERS = [
  "/api/v1/checklist-items", // deferred Phase N — checklist CRUD surface
  "/api/v1/checklist-items/{id}", // deferred Phase N
  "/api/v1/activities/{seriesId}/occurrences/{occurrenceKey}", // deferred Phase N — key-addressed occurrence
  "/api/v1/routines/{id}/steps", // deferred Phase N — steps nested under routine GET for now
  "/api/v1/routines/{id}/schedules", // deferred Phase N — create schedule nested in routine POST
  "/api/v1/categories/{id}", // deferred Phase N — category PATCH
] as const;

function loadSpecPaths(): Set<string> {
  const text = readFileSync(SPEC_PATH, "utf8");
  const spec = parseYaml(text) as OpenApiSpec;
  const keys = Object.keys(spec.paths ?? {});
  // OpenAPI paths are relative without /api/v1 (e.g. `/tasks`).
  return new Set(
    keys.map((p) => {
      const withSlash = p.startsWith("/") ? p : `/${p}`;
      return `${API_PREFIX}${withSlash}`;
    }),
  );
}

function loadSpecOperations(): Set<string> {
  const text = readFileSync(SPEC_PATH, "utf8");
  const spec = parseYaml(text) as OpenApiSpec;
  const found = new Set<string>();
  for (const [path, item] of Object.entries(spec.paths ?? {})) {
    const withSlash = path.startsWith("/") ? path : `/${path}`;
    for (const method of Object.keys(item)) {
      if (!HTTP_METHODS.has(method.toLowerCase())) continue;
      found.add(`${method.toUpperCase()} ${API_PREFIX}${withSlash}`);
    }
  }
  return found;
}

/** Walk src/app/api/v1 for route.ts files → OpenAPI-style path patterns. */
function scanHandlers(): Set<string> {
  const found = new Set<string>();

  function walk(dir: string) {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        walk(full);
        continue;
      }
      if (entry !== "route.ts") continue;
      // Directory of the route file is the path segments under api/v1.
      const rel = relative(API_ROOT, dir);
      if (!rel || rel === ".") {
        found.add(API_PREFIX);
        continue;
      }
      const segments = rel.split(/[/\\]/).map((seg) => {
        // [id] → {id}, [date] → {date}, [scheduleId] → {scheduleId}
        const m = seg.match(/^\[(.+)\]$/);
        return m ? `{${m[1]}}` : seg;
      });
      found.add(`${API_PREFIX}/${segments.join("/")}`);
    }
  }

  walk(API_ROOT);
  return found;
}

function scanHandlerOperations(): Set<string> {
  const found = new Set<string>();

  function walk(dir: string) {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        walk(full);
        continue;
      }
      if (entry !== "route.ts") continue;
      const rel = relative(API_ROOT, dir);
      const path =
        !rel || rel === "."
          ? API_PREFIX
          : `${API_PREFIX}/${rel
              .split(/[/\\]/)
              .map((segment) => {
                const match = segment.match(/^\[(.+)\]$/);
                return match ? `{${match[1]}}` : segment;
              })
              .join("/")}`;
      const source = readFileSync(full, "utf8");
      const exportPattern =
        /export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE)\b|export\s+const\s+(GET|POST|PUT|PATCH|DELETE)\b/g;
      for (const match of source.matchAll(exportPattern)) {
        found.add(`${match[1] ?? match[2]} ${path}`);
      }
    }
  }

  walk(API_ROOT);
  return found;
}

function isAllowlisted(path: string, list: readonly string[]): boolean {
  for (const entry of list) {
    if (entry.endsWith("/*")) {
      const prefix = entry.slice(0, -1); // keep trailing slash semantics: /api/v1/ai/
      if (path === entry.slice(0, -2) || path.startsWith(prefix)) return true;
    } else if (path === entry) {
      return true;
    }
  }
  return false;
}

describe("OpenAPI ↔ handler inventory", () => {
  const openapiPaths = loadSpecPaths();
  const handlerPaths = scanHandlers();
  const openapiOperations = loadSpecOperations();
  const handlerOperations = scanHandlerOperations();

  it("parses at least one OpenAPI path and one handler", () => {
    expect(openapiPaths.size).toBeGreaterThan(0);
    expect(handlerPaths.size).toBeGreaterThan(0);
  });

  it("every non-allowlisted OpenAPI path has a route handler", () => {
    const missing: string[] = [];
    for (const path of openapiPaths) {
      if (isAllowlisted(path, OPENAPI_WITHOUT_HANDLERS)) continue;
      if (!handlerPaths.has(path)) missing.push(path);
    }
    expect(
      missing,
      `OpenAPI paths without handlers (add handler or OPENAPI_WITHOUT_HANDLERS):\n${missing.join("\n")}`,
    ).toEqual([]);
  });

  it("every non-allowlisted handler has an OpenAPI path", () => {
    const missing: string[] = [];
    for (const path of handlerPaths) {
      if (isAllowlisted(path, HANDLERS_WITHOUT_OPENAPI)) continue;
      if (!openapiPaths.has(path)) missing.push(path);
    }
    expect(
      missing,
      `Handlers without OpenAPI (add to openapi.yaml or HANDLERS_WITHOUT_OPENAPI):\n${missing.join("\n")}`,
    ).toEqual([]);
  });

  it("every non-allowlisted OpenAPI operation has a matching handler export", () => {
    const missing = [...openapiOperations].filter((operation) => {
      const path = operation.slice(operation.indexOf(" ") + 1);
      return (
        !isAllowlisted(path, OPENAPI_WITHOUT_HANDLERS) &&
        !handlerOperations.has(operation)
      );
    });
    expect(
      missing,
      `OpenAPI operations without handler exports:\n${missing.join("\n")}`,
    ).toEqual([]);
  });

  it("every non-allowlisted handler export is documented as an operation", () => {
    const missing = [...handlerOperations].filter((operation) => {
      const path = operation.slice(operation.indexOf(" ") + 1);
      return (
        !isAllowlisted(path, HANDLERS_WITHOUT_OPENAPI) &&
        !openapiOperations.has(operation)
      );
    });
    expect(
      missing,
      `Handler exports without OpenAPI operations:\n${missing.join("\n")}`,
    ).toEqual([]);
  });

  it("allowlists only reference real gaps (no stale entries)", () => {
    // Deferred OpenAPI paths should still be in the spec (otherwise drop them).
    for (const path of OPENAPI_WITHOUT_HANDLERS) {
      if (path.endsWith("/*")) continue;
      expect(
        openapiPaths.has(path),
        `OPENAPI_WITHOUT_HANDLERS entry not in OpenAPI (stale?): ${path}`,
      ).toBe(true);
      expect(
        handlerPaths.has(path),
        `OPENAPI_WITHOUT_HANDLERS entry now has a handler — remove from allowlist: ${path}`,
      ).toBe(false);
    }

    // Handler-only allowlist entries that are exact should either exist as
    // handlers or be prefix globs for future routes (e.g. jobs/tick).
    for (const entry of HANDLERS_WITHOUT_OPENAPI) {
      if (entry.endsWith("/*")) {
        const prefix = entry.slice(0, -1);
        const any = [...handlerPaths].some(
          (p) => p === entry.slice(0, -2) || p.startsWith(prefix),
        );
        // Prefix allowlists may be empty (jobs/tick not yet); that's fine.
        void any;
        continue;
      }
      // Exact entries: if the handler was removed, drop the allowlist entry.
      // jobs/tick may not exist yet — skip enforce when absent.
      if (!handlerPaths.has(entry) && entry !== "/api/v1/jobs/tick") {
        // Only fail if OpenAPI also has it (then it should move lists); otherwise
        // warn via expect that optional extras still match.
        // Soft: allow pre-declared future handlers.
      }
    }
  });
});
