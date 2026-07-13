/**
 * GET /api/v1/categories — ADR-001/002, SEC-01.
 * Lists the user's six seeded categories, ordered by sortOrder. Seeds from
 * category_seed on first access (1C). Every query scoped by session userId.
 */
import { requireSession } from "@/server/auth-session";
import { listCategories } from "@/server/dal";
import { handleErrors } from "@/server/api-errors";

export async function GET() {
  return handleErrors(async () => {
    const { userId } = await requireSession();
    const categories = await listCategories(userId);
    return Response.json(
      { items: categories },
      { headers: { "cache-control": "private, no-store" } },
    );
  });
}
