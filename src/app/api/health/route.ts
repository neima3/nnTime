import type { Db } from "@/server/dal";

export const dynamic = "force-dynamic";

const PROCESS_STARTED_AT = new Date();

export async function GET() {
  const checks: Record<string, string> = {};
  let allOk = true;
  let connectedDb: Db | null = null;
  let schedulerLagSeconds: number | null = null;

  if (process.env.DATABASE_URL) {
    try {
      const { ensureMigrated, getMigrationStatus } = await import(
        "@/server/db/migrate-on-startup"
      );
      await ensureMigrated();
      const migration = getMigrationStatus();
      if (migration.ok) {
        checks.migrate = "ok";
      } else {
        checks.migrate = "fail";
        allOk = false;
      }
    } catch {
      checks.migrate = "fail";
      allOk = false;
    }
  }

  try {
    const [{ default: db }, { sql }] = await Promise.all([
      import("@/server/db"),
      import("drizzle-orm"),
    ]);
    await db.execute(sql`SELECT 1`);
    connectedDb = db as Db;
    checks.db = "ok";
  } catch {
    checks.db = "fail";
    allOk = false;
  }

  checks.ai = process.env.ANTHROPIC_API_KEY ? "ok" : "unconfigured";

  if (connectedDb) {
    try {
      const { getSchedulerHealth } = await import(
        "@/server/services/scheduler-runs"
      );
      const scheduler = await getSchedulerHealth({
        db: connectedDb,
        now: new Date(),
        configured: Boolean(process.env.CRON_SECRET),
        processStartedAt: PROCESS_STARTED_AT,
      });
      checks.scheduler = scheduler.state;
      schedulerLagSeconds = scheduler.lagSeconds;
      if (
        scheduler.state === "lagging" ||
        scheduler.state === "failed" ||
        (scheduler.state === "unconfigured" &&
          process.env.NODE_ENV === "production")
      ) {
        allOk = false;
      }
    } catch {
      checks.scheduler = "failed";
      allOk = false;
    }
  } else {
    checks.scheduler = "failed";
    allOk = false;
  }

  return Response.json(
    {
      status: allOk ? "ok" : "degraded",
      timestamp: new Date().toISOString(),
      checks,
      schedulerLagSeconds,
    },
    {
      status: allOk ? 200 : 503,
      headers: { "cache-control": "no-store" },
    },
  );
}
