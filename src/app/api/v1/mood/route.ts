/**
 * POST /api/v1/mood — mood check-in → planner_events.
 */
import { requireSession } from "@/server/auth-session";
import { handleErrors, parseBody } from "@/server/api-errors";
import { recordMoodCheckin } from "@/server/services/stats";
import { z } from "zod";

const bodySchema = z.object({
  mood: z.enum(["low", "okay", "good", "great"]),
  note: z.string().max(500).optional(),
});

export async function POST(request: Request) {
  return handleErrors(async () => {
    const { userId } = await requireSession();
    const body = await parseBody(request, bodySchema);
    if (body instanceof Response) return body;
    await recordMoodCheckin(userId, body.mood, body.note);
    return Response.json({ ok: true }, { status: 201 });
  });
}
