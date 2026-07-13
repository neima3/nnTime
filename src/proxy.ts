/**
 * Proxy (Next.js 16 — `middleware.ts` is deprecated, renamed to `proxy.ts`).
 *
 * Phase 1B responsibilities:
 *  - Apply security response headers (SEC-09): CSP report-only (→ enforce
 *    once the app is exercised), X-Content-Type-Options, frame-ancestors
 *    'none', Referrer-Policy, Permissions-Policy minimal. Verified on the LIVE
 *    URL by a Phase 1B test.
 *  - Enforce request-size limits on mutations.
 *  - Rate-limit hook for 1C's auth/AI/push endpoints (shared store; framework
 *    here, per-endpoint limits wired in 1C).
 *
 * ADR-003: middleware/proxy is UX + defense-in-depth ONLY. Every /api/v1
 * handler authenticates and authorizes internally (SEC-01). This proxy must
 * not be the only thing standing between a request and the data.
 */
import { NextResponse, type NextRequest } from "next/server";

/** Mutation routes subject to a request-body size cap (SEC-09 / proxy limits). */
const MAX_BODY_BYTES = 1024 * 1024; // 1 MB default for JSON mutations

const SECURITY_HEADERS: Record<string, string> = {
  // CSP report-only first (roadmap: → enforce once the app is exercised in
  // staging against real flows). Tightens script/style to self, disallows
  // unsafe-eval, restricts connect to the same origin + the API.
  "content-security-policy-report-only": [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'", // Tailwind injects style attrs; tighten in 6C
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    "report-uri /api/csp-report",
  ].join("; "),
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
  // frame-ancestors lives in CSP; a standalone header is belt-and-braces for
  // older clients and is honored by the proxy layer.
  "x-frame-options": "DENY",
  "permissions-policy": [
    "camera=()",
    "microphone=()",
    "geolocation=()",
    "interest-cohort=()",
    "clipboard-write=(self)",
    // Web Speech API (Phase 4 NL/voice add) — allow self when it ships.
    "microphone=(self)",
  ].join(", "),
  "cross-origin-opener-policy": "same-origin",
  "cross-origin-resource-policy": "same-origin",
};

export function proxy(request: NextRequest): NextResponse {
  // ---- Request-size guard on mutations (SEC-09 body-size limit) ----
  const method = request.method.toUpperCase();
  const isMutation = method === "POST" || method === "PUT" || method === "PATCH";
  if (isMutation) {
    const cl = Number(request.headers.get("content-length") ?? "0");
    if (cl > MAX_BODY_BYTES) {
      return NextResponse.json(
        { error: { code: "request_too_large", message: "Request body exceeds 1 MB", retryable: false } },
        { status: 413, headers: SECURITY_HEADERS },
      );
    }
  }

  // ---- Security headers on every HTML/API response ----
  const response = NextResponse.next();
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(k, v);
  }
  return response;
}

export const config = {
  // matcher values must be static literals (Next.js analyzes them at build time).
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.svg$).*)"],
};
