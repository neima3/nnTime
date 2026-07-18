/**
 * GET/POST /api/v1/tasks — ADR-002, SEC-01.
 * Every query scoped by session userId. Filter by ?bucket=inbox|anytime.
 */
import { requireSession } from "@/server/auth-session";
import { listTasks, createTask } from "@/server/dal";
import { handleErrors, parseBody } from "@/server/api-errors";
import { taskCreate } from "@/server/schemas/task";
import { checkRateLimit, rateLimitedResponse } from "@/server/ratelimit";
import { withIdempotency } from "@/server/idempotency";

export async function GET(request: Request) {
  return handleErrors(async () => {
    const { userId } = await requireSession();
    const url = new URL(request.url);
    const bucket = url.searchParams.get("bucket");
    const tasks = await listTasks(userId, {
      ...(bucket === "inbox" || bucket === "anytime" ? { bucket } : {}),
    });
    return Response.json(
      { items: tasks, nextCursor: null },
      { headers: { "cache-control": "private, no-store" } },
    );
  });
}

export async function POST(request: Request) {
  return handleErrors(async () => {
    const { userId } = await requireSession();
    const rl = await checkRateLimit(`api:tasks:create:${userId}`, {
      limit: 60,
      windowSec: 60,
    });
    if (!rl.allowed) return rateLimitedResponse(rl);
    const key = request.headers.get("idempotency-key");
    return withIdempotency(userId, key, "POST", "/api/v1/tasks", async () => {
      const body = await parseBody(request, taskCreate);
      if (body instanceof Response) return body;
      // zod dateStr is a string; the DAL expects a Date for the `date` column.
      const task = await createTask(userId, {
        ...body,
        ...(body.date ? { date: new Date(body.date) } : { date: null }),
      });
      return Response.json(task, { status: 201 });
    });
  });
}
