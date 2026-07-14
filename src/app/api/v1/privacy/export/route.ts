/**
 * GET /api/v1/privacy/export — SEC-10 data export (JSON, secrets redacted).
 */
import { requireSession } from "@/server/auth-session";
import { handleErrors } from "@/server/api-errors";
import { exportUserData } from "@/server/services/privacy";

export async function GET() {
  return handleErrors(async () => {
    const { userId } = await requireSession();
    const data = await exportUserData(userId);
    return Response.json(data, {
      headers: {
        "cache-control": "private, no-store",
        "content-disposition": 'attachment; filename="kairo-export.json"',
      },
    });
  });
}
