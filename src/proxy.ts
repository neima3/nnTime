/**
 * Proxy (Next.js 16 — middleware.ts renamed to proxy.ts).
 * Production security headers + request body limits + Origin/CSRF for /api/v1 mutations.
 */
import { NextResponse, type NextRequest } from "next/server";

const MAX_BODY_BYTES = 1024 * 1024; // 1 MB

const SECURITY_HEADERS: Record<string, string> = {
  "content-security-policy": [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join("; "),
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
  "x-frame-options": "DENY",
  "permissions-policy": [
    "camera=()",
    "microphone=()",
    "geolocation=()",
    "interest-cohort=()",
    "clipboard-write=(self)",
  ].join(", "),
  "cross-origin-opener-policy": "same-origin",
  "cross-origin-resource-policy": "same-origin",
};

const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/** Always-trusted web origins (prod + local dev). */
const BUILTIN_TRUSTED_ORIGINS = new Set([
  "https://time.neima.me",
  "http://localhost:3000",
  "https://localhost:3000",
]);

function trustedOrigins(): Set<string> {
  const set = new Set(BUILTIN_TRUSTED_ORIGINS);
  const extra = process.env.TRUSTED_ORIGINS ?? "";
  for (const o of extra.split(",")) {
    const t = o.trim();
    if (t) set.add(t);
  }
  return set;
}

function forbidden(message: string): NextResponse {
  return NextResponse.json(
    { error: { code: "forbidden", message, retryable: false } },
    { status: 403, headers: SECURITY_HEADERS },
  );
}

/**
 * CSRF / Origin guard for cookie-authenticated /api/v1 mutations (ADR-003/005).
 * - Skips GET/HEAD/OPTIONS and non-/api/v1 paths
 * - Skips /api/v1/jobs/tick (cron uses bearer CRON_SECRET, not cookies)
 * - Sec-Fetch-Site: cross-site → 403; same-origin / none / missing → allow
 * - Origin present → must match request origin or TRUSTED_ORIGINS allowlist
 * - Missing Origin allowed (native iOS / non-browser clients)
 */
function checkOriginCsrf(request: NextRequest): NextResponse | null {
  const method = request.method.toUpperCase();
  if (!MUTATION_METHODS.has(method)) return null;

  const pathname = request.nextUrl.pathname;
  if (!pathname.startsWith("/api/v1/")) return null;
  // Cron tick authenticates with bearer secret, not session cookies.
  if (pathname === "/api/v1/jobs/tick" || pathname.startsWith("/api/v1/jobs/tick/")) {
    return null;
  }

  const secFetchSite = request.headers.get("sec-fetch-site");
  if (secFetchSite === "cross-site") {
    return forbidden("Cross-site request blocked");
  }
  // same-origin | none | missing (and same-site) — Origin check below if present

  const origin = request.headers.get("origin");
  if (origin) {
    const requestOrigin = request.nextUrl.origin;
    const trusted = trustedOrigins();
    if (origin !== requestOrigin && !trusted.has(origin)) {
      return forbidden("Untrusted origin");
    }
  }

  return null;
}

export function proxy(request: NextRequest): NextResponse {
  const csrfBlock = checkOriginCsrf(request);
  if (csrfBlock) return csrfBlock;

  const method = request.method.toUpperCase();
  const isMutation =
    method === "POST" || method === "PUT" || method === "PATCH";
  if (isMutation) {
    const cl = Number(request.headers.get("content-length") ?? "0");
    if (cl > MAX_BODY_BYTES) {
      return NextResponse.json(
        {
          error: {
            code: "request_too_large",
            message: "Request body exceeds 1 MB",
            retryable: false,
          },
        },
        { status: 413, headers: SECURITY_HEADERS },
      );
    }
  }

  const response = NextResponse.next();
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(k, v);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.svg$).*)"],
};
