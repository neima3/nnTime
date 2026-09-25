/**
 * Moving a missed block to tomorrow must not stack it on top of a copy that
 * is already there. A daily routine has its own occurrence tomorrow; a weekly
 * one usually doesn't. Ask the day itself rather than guessing from the rule.
 */

/** YYYY-MM-DD one calendar day after `date`. */
export function nextDateStr(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d! + 1)).toISOString().slice(0, 10);
}

/**
 * Series ids that already have an occurrence on `date`. `null` when the day
 * couldn't be read — callers fall back to moving, the pre-existing behaviour.
 */
export async function seriesIdsOnDay(
  date: string,
  fetcher: typeof fetch = fetch,
): Promise<Set<string> | null> {
  try {
    const res = await fetcher(`/api/v1/day/${date}`);
    if (!res.ok) return null;
    const body = (await res.json()) as { activities?: { id?: string }[] };
    return new Set(
      (body.activities ?? []).map((a) => a.id).filter((id): id is string => !!id),
    );
  } catch {
    return null;
  }
}
