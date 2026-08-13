/**
 * POST /api/v1/ai/breakdown — SEC-05: no mutation; suggestion only.
 * Rate limited by the shared per-user AI quota (50 / 24h, see services/ai).
 */
import { requireSession } from "@/server/auth-session";
import { handleErrors, parseBody, errorResponse } from "@/server/api-errors";
import { breakDownTask, AiQuotaExceededError } from "@/server/services/ai";
import { rateLimitedResponse } from "@/server/ratelimit";
import { z } from "zod";

const bodySchema = z.object({
  title: z.string().min(1).max(200),
});

export async function POST(request: Request) {
  return handleErrors(async () => {
    const { userId } = await requireSession();
    const body = await parseBody(request, bodySchema);
    if (body instanceof Response) return body;
    if (!process.env.ANTHROPIC_API_KEY) {
      return errorResponse(
        "service_unavailable",
        "AI is not configured (missing ANTHROPIC_API_KEY). Add steps manually for now.",
        503,
      );
    }
    try {
      const result = await breakDownTask(body.title, userId);
      return Response.json(result);
    } catch (e) {
      if (e instanceof AiQuotaExceededError) {
        return rateLimitedResponse(e.result, "Daily AI quota exceeded");
      }
      console.error("[ai/breakdown]", e);
      return errorResponse("internal", "An unexpected error occurred", 500);
    }
  });
}
