/**
 * Proxy (Next.js 16 — middleware.ts renamed to proxy.ts).
 * Production security headers + request body limits.
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

export function proxy(request: NextRequest): NextResponse {
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

  const response = NextResponse.next();
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(k, v);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.svg$).*)"],
};
