/**
 * GET /api/v1/privacy/export — SEC-10 data export (JSON, secrets redacted).
 */
import { requireSession } from "@/server/auth-session";
import { handleErrors } from "@/server/api-errors";
import { checkRateLimit, rateLimitedResponse } from "@/server/ratelimit";
import { exportUserData } from "@/server/services/privacy";

export async function GET() {
  return handleErrors(async () => {
    const { userId } = await requireSession();
    // Full multi-table dump — expensive; 3/hour per user is plenty.
    const rl = await checkRateLimit(`privacy:export:${userId}`, {
      limit: 3,
      windowSec: 3600,
    });
    if (!rl.allowed) return rateLimitedResponse(rl);
    const data = await exportUserData(userId);
    return Response.json(data, {
      headers: {
        "cache-control": "private, no-store",
        "content-disposition": 'attachment; filename="kairo-export.json"',
      },
    });
  });
}
