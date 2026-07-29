import { errorResponse } from "@/server/api-errors";

function allowedOrigins(request: Request): Set<string> {
  const mode: string = process.env.NODE_ENV ?? "development";
  switch (mode) {
    case "production":
      return new Set(["https://time.neima.me"]);
    case "staging":
      return new Set(["https://time-staging.neima.me"]);
    default:
      return new Set([
        new URL(request.url).origin,
        "http://localhost:3000",
        "https://localhost:3000",
      ]);
  }
}

/**
 * Protect cookie-authenticated native API mutations from browser CSRF while
 * preserving native clients, which do not send browser Origin/Fetch-Metadata.
 */
export function enforceNativeMutationOrigin(
  request: Request,
): Response | null {
  if (request.headers.get("sec-fetch-site") === "cross-site") {
    return errorResponse(
      "forbidden",
      "Cross-site request blocked.",
      403,
    );
  }

  const origin = request.headers.get("origin");
  if (origin && !allowedOrigins(request).has(origin)) {
    return errorResponse("forbidden", "Untrusted origin.", 403);
  }
  return null;
}
