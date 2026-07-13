/**
 * GET/POST /api/v1/tags — ADR-002, SEC-01.
 * Every query scoped by session userId.
 */
import { requireSession } from "@/server/auth-session";
import { listTags, createTag } from "@/server/dal";
import { handleErrors, parseBody } from "@/server/api-errors";
import { tagCreate } from "@/server/schemas/tag";

export async function GET() {
  return handleErrors(async () => {
    const { userId } = await requireSession();
    const tags = await listTags(userId);
    return Response.json({ items: tags }, { headers: { "cache-control": "private, no-store" } });
  });
}

export async function POST(request: Request) {
  return handleErrors(async () => {
    const { userId } = await requireSession();
    const body = await parseBody(request, tagCreate);
    if (body instanceof Response) return body;
    const tag = await createTag(userId, body);
    return Response.json(tag, { status: 201 });
  });
}
