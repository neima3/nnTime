/**
 * POST /api/v1/ai/breakdown — SEC-05: no mutation; suggestion only.
 * Rate limited: 50 requests / 24h per user (atomic quota).
 */
import { requireSession } from "@/server/auth-session";
import { handleErrors, parseBody, errorResponse } from "@/server/api-errors";
import { breakDownTask } from "@/server/services/ai";
import { limitAI } from "@/server/ratelimit/middleware";
import { z } from "zod";

const bodySchema = z.object({
  title: z.string().min(1).max(200),
});

export async function POST(request: Request) {
  return handleErrors(async () => {
    const { userId } = await requireSession();
    
    // Rate limit: 50 AI requests per user per day
    const rl = await limitAI(userId);
    if (!rl.allowed) {
      return errorResponse("rate_limited", "Daily AI quota exceeded", 429);
    }

    const body = await parseBody(request, bodySchema);
    if (body instanceof Response) return body;
    if (!process.env.ANTHROPIC_API_KEY) {
      return errorResponse(
        "service_unavailable",
        "AI is not configured (missing ANTHROPIC_API_KEY). Add steps manually for now.",
        503,
      );
    }
    const result = await breakDownTask(body.title, userId);
    return Response.json(result);
  });
}
