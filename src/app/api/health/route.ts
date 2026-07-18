/**
 * Enhanced health endpoint — checks DB connectivity + migration readiness.
 * Returns 503 if DB is unreachable or migrations failed (Coolify healthcheck).
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const checks: Record<string, string> = {};
  let allOk = true;

  // Migration honesty: if DATABASE_URL is set, failed migrate → 503.
  if (process.env.DATABASE_URL) {
    try {
      const { ensureMigrated, getMigrationStatus } = await import(
        "@/server/db/migrate-on-startup"
      );
      await ensureMigrated();
      const mig = getMigrationStatus();
      if (!mig.ok) {
        checks.migrate = "fail";
        allOk = false;
      } else {
        checks.migrate = "ok";
      }
    } catch {
      checks.migrate = "fail";
      allOk = false;
    }
  }

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

  // AI is optional — unconfigured does not fail health.
  checks.ai = process.env.ANTHROPIC_API_KEY ? "ok" : "unconfigured";

  // Scheduler / cron auth — unconfigured is not a health failure (local/dev).
  checks.scheduler = process.env.CRON_SECRET ? "ok" : "unconfigured";

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
