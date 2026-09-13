/**
 * Occurrence-linked focus helpers (P1.3).
 *
 * Day blocks identify a (possibly virtual) instance as series id +
 * occurrenceKey. Focus start sends that pair; reload reconstructs it from
 * the server snapshot. Timer completion never completes the occurrence.
 */

export type FocusOccurrenceSelector = {
  activitySeriesId: string;
  occurrenceKey: string;
};

export type FocusSessionIdentity = FocusOccurrenceSelector & {
  activityOccurrenceId: string | null;
};

export type FocusStartInput = {
  targetDurationMin: number;
  title?: string;
  emoji?: string;
  activitySeriesId?: string | null;
  occurrenceKey?: string | null;
};

export type FocusStartBody = {
  targetDurationMin: number;
  title?: string;
  emoji?: string;
  activitySeriesId?: string;
  occurrenceKey?: string;
};

export type CompleteLinkedOccurrenceResult =
  | { ok: true; revision: number }
  | {
      ok: false;
      reason: "missing-identity" | "not-found" | "conflict" | "network" | "http";
      retryable: boolean;
    };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function pairedFocusSelector(
  activitySeriesId?: string | null,
  occurrenceKey?: string | null,
): FocusOccurrenceSelector | null {
  const seriesId = activitySeriesId?.trim() ?? "";
  const key = occurrenceKey?.trim() ?? "";
  if (!seriesId || !key) return null;
  if (!UUID_RE.test(seriesId)) return null;
  return { activitySeriesId: seriesId, occurrenceKey: key };
}

export function focusStartBody(input: FocusStartInput): FocusStartBody {
  const body: FocusStartBody = {
    targetDurationMin: input.targetDurationMin,
  };
  if (input.title !== undefined) body.title = input.title;
  if (input.emoji !== undefined) body.emoji = input.emoji;
  const selector = pairedFocusSelector(
    input.activitySeriesId,
    input.occurrenceKey,
  );
  if (selector) {
    body.activitySeriesId = selector.activitySeriesId;
    body.occurrenceKey = selector.occurrenceKey;
  }
  return body;
}

/** Stable fingerprint so retries of the same start reuse one idempotency key. */
export function focusStartFingerprint(body: FocusStartBody): string {
  return JSON.stringify({
    targetDurationMin: body.targetDurationMin,
    title: body.title ?? null,
    emoji: body.emoji ?? null,
    activitySeriesId: body.activitySeriesId ?? null,
    occurrenceKey: body.occurrenceKey ?? null,
  });
}

export function adoptFocusLinkage(session: {
  activityOccurrenceId?: string | null;
  activitySeriesId?: string | null;
  occurrenceKey?: string | Date | null;
} | null): FocusSessionIdentity | null {
  if (!session) return null;
  const occurrenceKey =
    session.occurrenceKey instanceof Date
      ? session.occurrenceKey.toISOString()
      : (session.occurrenceKey ?? null);
  const selector = pairedFocusSelector(session.activitySeriesId, occurrenceKey);
  if (!selector) return null;
  return {
    ...selector,
    activityOccurrenceId: session.activityOccurrenceId ?? null,
  };
}

export function canMarkOccurrenceDone(
  link: { activitySeriesId?: string | null; occurrenceKey?: string | null } | null,
): boolean {
  return pairedFocusSelector(link?.activitySeriesId, link?.occurrenceKey) != null;
}

export function focusHrefFromActivity(input: {
  title: string;
  emoji: string;
  durationMin: number;
  activityId?: string | null;
  occurrenceKey?: string | null;
}): string {
  const params = new URLSearchParams({
    title: input.title,
    emoji: input.emoji,
    duration: String(input.durationMin),
  });
  if (input.activityId) params.set("activityId", input.activityId);
  if (input.occurrenceKey) params.set("occurrenceKey", input.occurrenceKey);
  return `/app/focus?${params}`;
}

type FetchLike = (
  input: string,
  init?: RequestInit,
) => Promise<Response>;

/**
 * Occurrence-scoped completion used by Focus "Mark done".
 *
 * Uses the live GET + If-Match + Idempotency-Key path (same field group as
 * Today ✓). 409 rebases onto a fresh revision with a new key. A missing
 * series/occurrence is terminal — never rewrite another instance.
 */
export async function completeLinkedOccurrence(input: {
  activitySeriesId?: string | null;
  occurrenceKey?: string | null;
  fetchFn?: FetchLike;
  uuid?: () => string;
  now?: () => Date;
  maxConflictRetries?: number;
}): Promise<CompleteLinkedOccurrenceResult> {
  const selector = pairedFocusSelector(
    input.activitySeriesId,
    input.occurrenceKey,
  );
  if (!selector) {
    return { ok: false, reason: "missing-identity", retryable: false };
  }
  const fetchFn = input.fetchFn ?? fetch;
  const uuid = input.uuid ?? (() => crypto.randomUUID());
  const now = input.now ?? (() => new Date());
  const maxConflictRetries = input.maxConflictRetries ?? 2;
  const path = `/api/v1/activities/${selector.activitySeriesId}`;

  for (let attempt = 0; attempt <= maxConflictRetries; attempt++) {
    let current: { revision?: number };
    try {
      const getRes = await fetchFn(path);
      if (getRes.status === 404) {
        return { ok: false, reason: "not-found", retryable: false };
      }
      if (!getRes.ok) {
        return {
          ok: false,
          reason: "http",
          retryable: getRes.status >= 500 || getRes.status === 429,
        };
      }
      current = (await getRes.json()) as { revision?: number };
    } catch {
      return { ok: false, reason: "network", retryable: true };
    }
    if (typeof current.revision !== "number") {
      return { ok: false, reason: "http", retryable: false };
    }

    const key = uuid();
    try {
      const patchRes = await fetchFn(path, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "If-Match": String(current.revision),
          "Idempotency-Key": key,
        },
        body: JSON.stringify({
          editScope: "this",
          occurrenceKey: selector.occurrenceKey,
          status: "completed",
          completedAt: now().toISOString(),
        }),
      });
      if (patchRes.status === 404) {
        return { ok: false, reason: "not-found", retryable: false };
      }
      if (patchRes.status === 409) {
        if (attempt === maxConflictRetries) {
          return { ok: false, reason: "conflict", retryable: true };
        }
        continue;
      }
      if (!patchRes.ok) {
        return {
          ok: false,
          reason: "http",
          retryable: patchRes.status >= 500 || patchRes.status === 429,
        };
      }
      const updated = (await patchRes.json()) as { revision?: number };
      return { ok: true, revision: updated.revision ?? current.revision + 1 };
    } catch {
      return { ok: false, reason: "network", retryable: true };
    }
  }
  return { ok: false, reason: "conflict", retryable: true };
}

export function markDoneErrorMessage(
  result: Extract<CompleteLinkedOccurrenceResult, { ok: false }>,
): string {
  if (result.reason === "not-found") {
    return "That block is gone — nothing else was marked done.";
  }
  if (result.reason === "network") {
    return "Couldn't reach the server — try again.";
  }
  if (result.reason === "conflict") {
    return "The plan changed elsewhere — try again.";
  }
  return "Couldn't mark it done here — try again.";
}
