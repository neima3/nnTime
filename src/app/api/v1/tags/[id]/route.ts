/**
 * GET/PATCH/DELETE /api/v1/tags/{id} — ADR-002, SEC-01.
 * Cross-user access returns 404 (NotFoundError). If-Match required on mutations.
 */
import { requireSession } from "@/server/auth-session";
import { getTag, updateTag, deleteTag } from "@/server/dal";
import { handleErrors, parseBody, errorResponse } from "@/server/api-errors";
import { tagUpdate } from "@/server/schemas/tag";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handleErrors(async () => {
    const { userId } = await requireSession();
    const { id } = await params;
    const tag = await getTag(userId, id);
    return Response.json(tag, { headers: { "cache-control": "private, no-store" } });
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
    const body = await parseBody(request, tagUpdate);
    if (body instanceof Response) return body;
    const tag = await updateTag(userId, id, body, Number(ifMatch));
    return Response.json(tag);
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
    await deleteTag(userId, id, Number(ifMatch));
    return new Response(null, { status: 204 });
  });
}
