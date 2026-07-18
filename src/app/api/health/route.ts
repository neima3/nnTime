/**
 * Enhanced health endpoint — checks DB connectivity for deeper monitoring.
 * Returns 503 if DB is unreachable (Coolify healthcheck will restart).
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const checks: Record<string, string> = {};
  let allOk = true;

  // Check DB connectivity
  try {
    const { default: db } = await import("@/server/db");
    const { sql } = await import("drizzle-orm");
    await db.execute(sql`SELECT 1`);
    checks.db = "ok";
  } catch {
    checks.db = "fail";
    allOk = false;
  }

  // Check AI config
  checks.ai = process.env.ANTHROPIC_API_KEY ? "ok" : "unconfigured";

  return Response.json(
    {
      status: allOk ? "ok" : "degraded",
      timestamp: new Date().toISOString(),
      checks,
    },
    {
      status: allOk ? 200 : 503,
      headers: { "cache-control": "no-store" },
    },
  );
}
