/**
 * POST /api/v1/tasks/import — bulk import tasks from a JSON array.
 * Body: { tasks: [{ title, bucket?, priority?, emoji? }, ...] }
 */
import { requireSession } from "@/server/auth-session";
import { createTask } from "@/server/dal";
import { handleErrors, errorResponse } from "@/server/api-errors";
import { z } from "zod";

const importSchema = z.object({
  tasks: z.array(z.object({
    title: z.string().min(1).max(200),
    bucket: z.enum(["inbox", "anytime"]).optional().default("inbox"),
    priority: z.enum(["none", "low", "high"]).optional().default("none"),
    emoji: z.string().max(10).optional(),
  })).min(1).max(100),
});

export async function POST(request: Request) {
  return handleErrors(async () => {
    const { userId } = await requireSession();
    let json: unknown;
    try {
      json = await request.json();
    } catch {
      return errorResponse("bad_request", "Invalid JSON body", 400);
    }
    const parsed = importSchema.safeParse(json);
    if (!parsed.success) {
      return errorResponse("bad_request", "Validation failed", 400, {
        details: parsed.error.issues,
      });
    }

    const created = [];
    for (const task of parsed.data.tasks) {
      const row = await createTask(userId, {
        bucket: task.bucket,
        title: task.title,
        emoji: task.emoji,
        priority: task.priority,
      });
      created.push({ id: row.id, title: row.title, bucket: row.bucket });
    }

    return Response.json({ imported: created.length, tasks: created }, { status: 201 });
  });
}
