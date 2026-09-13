/**
 * Shared mutation-failure copy for capture, schedule, and routine families.
 *
 * Status-specific messages stay truthful; family fallbacks remain the last
 * resort so Round 92 strings are not rewritten.
 */

export function shouldRetainIdempotencyKey(status: number | null): boolean {
  if (status == null) return true;
  if (status >= 200 && status < 300) return false;
  if (status === 400 || status === 404) return false;
  return true;
}

export function mutationFailureMessage(
  status: number | null,
  opts: {
    fallback: string;
    unauthorized?: string;
    conflict?: string;
    offline?: string;
    serverMessage?: string | null;
    offlineNow?: boolean;
  },
): string {
  if (opts.offlineNow) {
    return opts.offline ?? "You're offline — reconnect and try again";
  }
  if (status === 401) {
    return opts.unauthorized ?? "Sign in to continue.";
  }
  if (status === 409 || status === 412) {
    return (
      opts.conflict ?? "That one changed somewhere else — reload and try again"
    );
  }
  if (status === 429) {
    return opts.serverMessage ?? "Too many requests — wait a moment and try again";
  }
  if (status != null && status >= 500) {
    return opts.serverMessage ?? opts.fallback;
  }
  if (status == null) {
    return "Couldn't reach the server — try again?";
  }
  return opts.serverMessage ?? opts.fallback;
}
