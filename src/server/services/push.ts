/**
 * Web Push delivery (F1) — sends a payload to a stored subscription via VAPID.
 *
 * Pairs with the iOS local reminders: same "gentle nudge" idea, delivered to
 * the browser/PWA even when the tab is closed. Stale subscriptions (404/410)
 * are tombstoned so we stop trying them.
 */
import "server-only";
import webpush from "web-push";
import type { Db } from "../dal";
import dbDefault from "../db";
import * as schema from "../db/schema";
import { getOrCreateSettings } from "../dal";
import { instantToWallFields } from "../temporal/zone";
import { isQuietAt, startNudgesEnabled } from "@/lib/quiet-hours";
import { and, eq, isNull, gte, lte, sql } from "drizzle-orm";

let configured = false;

/** Lazily configure VAPID from env. Returns false if keys are missing. */
export function pushConfigured(): boolean {
  if (configured) return true;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT ?? "mailto:hello@time.neima.me";
  if (!pub || !priv) return false;
  webpush.setVapidDetails(subject, pub, priv);
  configured = true;
  return true;
}

export interface PushPayload {
  title: string;
  body: string;
  tag?: string;
  url?: string;
}

export interface PushDeliveryResult {
  configured: boolean;
  subscriptions: number;
  sent: number;
  pruned: number;
  retryableFailures: number;
}

/**
 * Send a payload to every live subscription for a user. Returns how many were
 * delivered. Prunes subscriptions the push service reports as gone.
 */
export async function sendToUser(
  userId: string,
  payload: PushPayload,
  opts: {
    db?: Db;
    sendNotification?: typeof webpush.sendNotification;
  } = {},
): Promise<PushDeliveryResult> {
  if (!pushConfigured()) {
    return {
      configured: false,
      subscriptions: 0,
      sent: 0,
      pruned: 0,
      retryableFailures: 0,
    };
  }
  const db = opts.db ?? dbDefault;
  const sendNotification =
    opts.sendNotification ?? webpush.sendNotification.bind(webpush);

  const subs = await db
    .select()
    .from(schema.pushSubscriptions)
    .where(
      and(
        eq(schema.pushSubscriptions.userId, userId),
        isNull(schema.pushSubscriptions.deletedAt),
      ),
    );

  let sent = 0;
  let pruned = 0;
  let retryableFailures = 0;
  const body = JSON.stringify(payload);

  for (const sub of subs) {
    try {
      await sendNotification(
        { endpoint: sub.endpoint, keys: sub.keys as { p256dh: string; auth: string } },
        body,
      );
      sent++;
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        await db
          .update(schema.pushSubscriptions)
          .set({ deletedAt: new Date() })
          .where(eq(schema.pushSubscriptions.id, sub.id));
        pruned++;
      } else {
        retryableFailures++;
      }
    }
  }
  return {
    configured: true,
    subscriptions: subs.length,
    sent,
    pruned,
    retryableFailures,
  };
}

/**
 * Deliver due "start" nudges (H1). Finds notification jobs whose fire time is
 * within [now-2m, now+2m], sends a push for each (respecting the user's quiet
 * hours), and marks them sent in-place so a later tick won't repeat. Called by
 * jobs/tick — pair with a cron hitting that endpoint every minute or two.
 */
export async function deliverDueNudges(
  opts: { db?: Db; now?: Date } = {},
): Promise<{ delivered: number; suppressed: number; considered: number }> {
  if (!pushConfigured()) return { delivered: 0, suppressed: 0, considered: 0 };
  const db = opts.db ?? dbDefault;
  const now = opts.now ?? new Date();
  const from = new Date(now.getTime() - 2 * 60 * 1000);
  const to = new Date(now.getTime() + 2 * 60 * 1000);

  const due = await db
    .select()
    .from(schema.plannerEvents)
    .where(
      and(
        eq(schema.plannerEvents.entityType, "notification"),
        gte(schema.plannerEvents.occurredAt, from),
        lte(schema.plannerEvents.occurredAt, to),
        sql`${schema.plannerEvents.payload}->>'type' = 'start'`,
        sql`(${schema.plannerEvents.payload}->>'sent') IS DISTINCT FROM 'true'`,
      ),
    )
    .limit(200);

  let delivered = 0;
  let suppressed = 0;

  for (const job of due) {
    // Look up the activity for friendly copy.
    const [series] = await db
      .select()
      .from(schema.activitySeries)
      .where(eq(schema.activitySeries.id, job.entityId))
      .limit(1);
    if (!series || series.deletedAt) {
      await markSent(db, job.id);
      continue;
    }

    // Per-type toggle + quiet hours (per user timezone).
    const settings = await getOrCreateSettings(job.userId);
    if (!startNudgesEnabled(settings.notificationPrefs)) {
      suppressed++;
      await markSent(db, job.id);
      continue;
    }
    const hour = instantToWallFields(job.occurredAt, settings.timezone).hour;
    if (isQuietAt(settings.notificationPrefs, hour)) {
      suppressed++;
      await markSent(db, job.id);
      continue;
    }

    const { sent } = await sendToUser(
      job.userId,
      {
        title: `${series.emoji ?? "⏰"} ${series.title}`,
        body: "Starting now — no rush, just a nudge.",
        tag: `start-${series.id}`,
        url: "/app/today",
      },
      { db },
    );
    if (sent > 0) delivered++;
    await markSent(db, job.id);
  }

  return { delivered, suppressed, considered: due.length };
}

async function markSent(db: Db, jobId: string) {
  await db
    .update(schema.plannerEvents)
    .set({
      payload: sql`jsonb_set(${schema.plannerEvents.payload}, '{sent}', '"true"'::jsonb)`,
    })
    .where(eq(schema.plannerEvents.id, jobId));
}
