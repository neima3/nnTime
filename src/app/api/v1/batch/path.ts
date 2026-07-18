/**
 * Pure path helpers for batch op denylist (no Next/runtime deps).
 */

const ALLOWED_PREFIX = "/api/v1/";

/**
 * Normalize batch op path: pathname only (strip query/hash), collapse trailing
 * slash except root.
 */
export function normalizeBatchPath(path: string): string {
  let p = path.split("?")[0] ?? path;
  p = p.split("#")[0] ?? p;
  if (p.length > 1 && p.endsWith("/")) {
    p = p.replace(/\/+$/, "");
    if (p === "") p = "/";
  }
  return p;
}

/** True if path is allowed as a batch sub-operation target. */
export function isAllowedBatchPath(path: string): boolean {
  if (!path.startsWith(ALLOWED_PREFIX)) return false;
  if (path.includes("..") || path.includes("//")) return false;
  // No recursive batch fan-out
  if (path === "/api/v1/batch" || path.startsWith("/api/v1/batch/")) return false;
  return true;
}
