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
import { and, eq, isNull } from "drizzle-orm";

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

/**
 * Send a payload to every live subscription for a user. Returns how many were
 * delivered. Prunes subscriptions the push service reports as gone.
 */
export async function sendToUser(
  userId: string,
  payload: PushPayload,
  opts: { db?: Db } = {},
): Promise<{ sent: number; pruned: number }> {
  if (!pushConfigured()) return { sent: 0, pruned: 0 };
  const db = opts.db ?? dbDefault;

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
  const body = JSON.stringify(payload);

  for (const sub of subs) {
    try {
      await webpush.sendNotification(
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
      }
    }
  }
  return { sent, pruned };
}
