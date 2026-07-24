/**
 * POST/DELETE /api/v1/push/subscribe — register or remove a Web Push
 * subscription for the current user (F1). SEC-01 user-scoped.
 */
import { requireSession } from "@/server/auth-session";
import {
  registerPushSubscription,
  unregisterPushSubscription,
} from "@/server/services/notifications";
import { handleErrors, parseBody } from "@/server/api-errors";
import { z } from "zod";

const subscribeBody = z.object({
  endpoint: z.string().url(),
  keys: z.object({ p256dh: z.string(), auth: z.string() }),
});

export async function POST(request: Request) {
  return handleErrors(async () => {
    const { userId } = await requireSession();
    const body = await parseBody(request, subscribeBody);
    if (body instanceof Response) return body;
    await registerPushSubscription(userId, {
      endpoint: body.endpoint,
      keys: body.keys,
    });
    return Response.json({ ok: true });
  });
}

const unsubscribeBody = z.object({ endpoint: z.string().url() });

export async function DELETE(request: Request) {
  return handleErrors(async () => {
    const { userId } = await requireSession();
    const body = await parseBody(request, unsubscribeBody);
    if (body instanceof Response) return body;
    await unregisterPushSubscription(userId, body.endpoint);
    return Response.json({ ok: true });
  });
}
