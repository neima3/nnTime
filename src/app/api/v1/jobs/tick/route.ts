/**
 * POST /api/v1/jobs/tick — ADR-004 scheduler tick endpoint.
 *
 * Coolify cron (or external scheduler) hits this authenticated route once per
 * minute. Runs the routine materializer and optional notification tick under
 * their own advisory locks.
 *
 * Auth: Authorization: Bearer ${CRON_SECRET} OR x-cron-secret: ${CRON_SECRET}
 */
import { materializeRoutines } from "@/server/services/routine-materializer";
import { computeNotificationJobs } from "@/server/services/notifications";
import { logger } from "@/server/log";

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

  if (bearer === secret || xCron === secret) {
    return null;
  }

  return Response.json(
    { error: "unauthorized" },
    { status: 401, headers: { "cache-control": "no-store" } },
  );
}

export async function POST(request: Request) {
  const denied = authorizeCron(request);
  if (denied) return denied;

  try {
    const materialize = await materializeRoutines();

    let notifications: { created: number; pruned: number } | null = null;
    let notificationsError: string | null = null;
    try {
      notifications = await computeNotificationJobs();
    } catch (e) {
      notificationsError = e instanceof Error ? e.message : String(e);
      logger.warn("jobs/tick notification tick failed", {
        error: notificationsError,
      });
    }

    return Response.json(
      {
        ok: true,
        timestamp: new Date().toISOString(),
        materialize,
        notifications,
        notificationsError,
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    logger.error("jobs/tick failed", { error: message });
    return Response.json(
      { ok: false, error: message },
      { status: 500, headers: { "cache-control": "no-store" } },
    );
  }
}
