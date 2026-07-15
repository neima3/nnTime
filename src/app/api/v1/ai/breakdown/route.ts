/**
 * POST /api/v1/ai/breakdown — SEC-05: no mutation; suggestion only.
 */
import { requireSession } from "@/server/auth-session";
import { handleErrors, parseBody, errorResponse } from "@/server/api-errors";
import { breakDownTask } from "@/server/services/ai";
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
      const msg = e instanceof Error ? e.message : "AI error";
      if (msg.includes("quota")) {
        return errorResponse("rate_limited", msg, 429, { retryable: true });
      }
      return errorResponse("internal", msg, 500);
    }
  });
}
