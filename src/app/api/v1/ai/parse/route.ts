/**
 * POST /api/v1/ai/parse — NL → draft task (SEC-05 suggestion only).
 */
import { requireSession } from "@/server/auth-session";
import { handleErrors, parseBody, errorResponse } from "@/server/api-errors";
import { rateLimitedResponse } from "@/server/ratelimit";
import { parseNaturalLanguage, AiQuotaExceededError, AiUnavailableError } from "@/server/services/ai";
import { z } from "zod";

const bodySchema = z.object({
  input: z.string().min(1).max(500),
});

export async function POST(request: Request) {
  return handleErrors(async () => {
    const { userId } = await requireSession();
    const body = await parseBody(request, bodySchema);
    if (body instanceof Response) return body;
    if (!process.env.ANTHROPIC_API_KEY) {
      return errorResponse(
        "service_unavailable",
        "AI is not configured. Try a clear title instead.",
        503,
      );
    }
    try {
      const result = await parseNaturalLanguage(body.input, userId);
      return Response.json(result);
    } catch (e) {
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
      console.error("[ai/parse]", e);
      return errorResponse("internal", "An unexpected error occurred", 500);
    }
  });
}
