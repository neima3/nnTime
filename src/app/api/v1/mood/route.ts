/**
 * POST /api/v1/mood — mood check-in → planner_events.
 */
import { requireSession } from "@/server/auth-session";
import { handleErrors, parseBody } from "@/server/api-errors";
import { recordMoodCheckin } from "@/server/services/stats";
import {
  moodCheckinRequest,
  moodCheckinResponse,
} from "@/server/schemas/stats";
import { withIdempotency } from "@/server/idempotency";

export async function POST(request: Request) {
  return handleErrors(async () => {
    const { userId } = await requireSession();
    const key = request.headers.get("idempotency-key");
    return withIdempotency(userId, key, "POST", "/api/v1/mood", async (db) => {
      const body = await parseBody(request, moodCheckinRequest);
      if (body instanceof Response) return body;
      await recordMoodCheckin(userId, body.mood, body.note, { db });
      return Response.json(moodCheckinResponse.parse({ ok: true }), {
        status: 201,
        headers: { "cache-control": "private, no-store" },
      });
    });
  });
}
