/**
 * Shared AI route error mapping — SEC-05 truthful failures, no silent mutation.
 */
import { ZodError } from "zod";
import { errorResponse } from "@/server/api-errors";
import { rateLimitedResponse } from "@/server/ratelimit";
import { AiQuotaExceededError, AiUnavailableError } from "@/server/services/ai";

export function mapAiRouteError(e: unknown, logTag: string): Response {
  if (e instanceof AiUnavailableError) {
    return errorResponse(
      "service_unavailable",
      "The AI co-planner is unavailable right now. Your plan is untouched — try again shortly.",
      503,
      { retryable: true },
    );
  }
  if (e instanceof AiQuotaExceededError) {
    return rateLimitedResponse(e.result, "Daily AI quota exceeded");
  }
  if (e instanceof ZodError || e instanceof SyntaxError) {
    return errorResponse(
      "bad_gateway",
      "AI returned data we couldn't trust. Nothing was saved — try again.",
      502,
      { retryable: true },
    );
  }
  console.error(logTag, e);
  return errorResponse("internal", "An unexpected error occurred", 500);
}
