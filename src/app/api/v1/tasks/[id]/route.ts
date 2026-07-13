/**
 * GET/PATCH/DELETE /api/v1/tasks/{id} — ADR-002, SEC-01.
 * Cross-user access returns 404 (NotFoundError). If-Match required on mutations.
 */
import { requireSession } from "@/server/auth-session";
import { getTask, updateTask, deleteTask } from "@/server/dal";
import { handleErrors, parseBody, errorResponse } from "@/server/api-errors";
import { taskUpdate } from "@/server/schemas/task";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handleErrors(async () => {
    const { userId } = await requireSession();
    const { id } = await params;
    const task = await getTask(userId, id);
    return Response.json(task, { headers: { "cache-control": "private, no-store" } });
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handleErrors(async () => {
    const { userId } = await requireSession();
    const { id } = await params;
    const ifMatch = request.headers.get("if-match");
    if (!ifMatch) {
      return errorResponse("precondition_required", "If-Match header required", 428);
    }
    const body = await parseBody(request, taskUpdate);
    if (body instanceof Response) return body;
    // Normalize: zod allows null for some fields; strip nulls to undefined so
    // the DAL's Partial<...> type accepts it, and convert date string → Date.
    const update: Record<string, unknown> = { ...body };
    if ("date" in update) {
      update.date = body.date ? new Date(body.date) : null;
    }
    const task = await updateTask(userId, id, update, Number(ifMatch));
    return Response.json(task);
  });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handleErrors(async () => {
    const { userId } = await requireSession();
    const { id } = await params;
    const ifMatch = request.headers.get("if-match");
    if (!ifMatch) {
      return errorResponse("precondition_required", "If-Match header required", 428);
    }
    await deleteTask(userId, id, Number(ifMatch));
    return new Response(null, { status: 204 });
  });
}
