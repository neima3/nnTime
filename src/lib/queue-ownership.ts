export const QUEUE_OWNER_HEADER = "X-Kairo-Queue-Owner";

export function assertQueueOwner(
  authenticatedUserId: string,
  queuedUserId: string | null,
): void {
  if (!queuedUserId || queuedUserId === authenticatedUserId) return;
  throw new Response(
    JSON.stringify({
      error: {
        code: "queue_owner_mismatch",
        message: "Queued change belongs to another account",
        retryable: false,
      },
    }),
    {
      status: 403,
      headers: { "content-type": "application/json" },
    },
  );
}
