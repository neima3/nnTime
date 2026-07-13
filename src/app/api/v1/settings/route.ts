/**
 * GET/PATCH /api/v1/settings — ADR-001/002, SEC-01.
 * The authenticated user's typed settings row. GET lazily creates defaults
 * (timezone from the request `x-timezone` header or 'UTC') on first access.
 * PATCH requires If-Match (settings carries a monotonic revision).
 */
import { requireSession } from "@/server/auth-session";
import { getOrCreateSettings, updateSettings } from "@/server/dal";
import { handleErrors, parseBody, errorResponse } from "@/server/api-errors";
import { userSettingsUpdate } from "@/server/schemas/user-settings";

export async function GET(request: Request) {
  return handleErrors(async () => {
    const { userId } = await requireSession();
    const timezoneHint = request.headers.get("x-timezone") ?? undefined;
    const settings = await getOrCreateSettings(userId, { timezoneHint });
    return Response.json(settings, { headers: { "cache-control": "private, no-store" } });
  });
}

export async function PATCH(request: Request) {
  return handleErrors(async () => {
    const { userId } = await requireSession();
    const ifMatch = request.headers.get("if-match");
    if (!ifMatch) {
      return errorResponse("precondition_required", "If-Match header required", 428);
    }
    const body = await parseBody(request, userSettingsUpdate);
    if (body instanceof Response) return body;
    const settings = await updateSettings(userId, body, Number(ifMatch));
    return Response.json(settings);
  });
}
