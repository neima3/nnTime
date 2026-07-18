/**
 * POST /api/v1/ai/parse — NL → draft task (SEC-05 suggestion only).
 */
import { requireSession } from "@/server/auth-session";
import { handleErrors, parseBody, errorResponse } from "@/server/api-errors";
import { parseNaturalLanguage } from "@/server/services/ai";
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
      const msg = e instanceof Error ? e.message : "AI error";
      if (msg.includes("quota")) {
        return errorResponse("rate_limited", "Daily AI quota exceeded", 429, {
          retryable: true,
        });
      }
      console.error("[ai/parse]", e);
      return errorResponse("internal", "An unexpected error occurred", 500);
    }
  });
}
