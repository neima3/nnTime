import db from "@/server/db";
import { logger } from "@/server/log";
import { deliverDueNotificationJobs } from "@/server/services/notification-delivery";
import { computeNotificationJobs } from "@/server/services/notifications";
import { materializeRoutines } from "@/server/services/routine-materializer";
import {
  failSchedulerRun,
  pruneSchedulerRuns,
  startSchedulerRun,
  succeedSchedulerRun,
} from "@/server/services/scheduler-runs";

export const dynamic = "force-dynamic";

function authorizeCron(request: Request): Response | null {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  const bearer =
    auth?.startsWith("Bearer ") ? auth.slice("Bearer ".length).trim() : null;
  const xCron = request.headers.get("x-cron-secret");

  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      return Response.json(
        { error: "CRON_SECRET unconfigured" },
        { status: 503, headers: { "cache-control": "no-store" } },
      );
    }
    logger.warn("jobs/tick allowed without CRON_SECRET (development)");
    return null;
  }

  if (bearer === secret || xCron === secret) return null;

  return Response.json(
    { error: "unauthorized" },
    { status: 401, headers: { "cache-control": "no-store" } },
  );
}

export async function POST(request: Request) {
  const denied = authorizeCron(request);
  if (denied) return denied;

  const startedAt = new Date();
  let runId: string | null = null;
  try {
    runId = await startSchedulerRun(db, startedAt);
    const materialize = await materializeRoutines();
    const notifications = await computeNotificationJobs();
    const delivery = await deliverDueNotificationJobs();
    const summary = { materialize, notifications, delivery };
    const finishedAt = new Date();

    await succeedSchedulerRun(db, runId, finishedAt, summary);
    await pruneSchedulerRuns(db, finishedAt);

    return Response.json(
      {
        ok: true,
        timestamp: finishedAt.toISOString(),
        ...summary,
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    if (runId) {
      try {
        await failSchedulerRun(db, runId, new Date(), error);
      } catch {
        logger.error("jobs/tick could not record failed scheduler run");
      }
    }
    logger.error("jobs/tick failed");
    return Response.json(
      { ok: false, error: "scheduler tick failed" },
      {
        status: 500,
        headers: { "cache-control": "no-store" },
      },
    );
  }
}
