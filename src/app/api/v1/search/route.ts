/**
 * GET /api/v1/search?q=&limit= — planner search (H3). ADR-002, SEC-01.
 *
 * Searches the user's activity series and tasks by title, falling back to notes.
 * Matching/ranking lives in `@/lib/search` so web and iOS behave identically and
 * the rules are unit-testable without a database.
 *
 * Series (not expanded occurrences) are the unit on purpose: someone searching a
 * planner is looking for a named thing, and expanding every recurrence across a
 * window to match the same title N times would be both slower and noisier. The
 * anchor date returned is the series' own start; `repeats` tells the client the
 * thing recurs so it can say so.
 */
import { requireSession } from "@/server/auth-session";
import { handleErrors, errorResponse } from "@/server/api-errors";
import { listActivitySeries, listTasks, getOrCreateSettings } from "@/server/dal";
import { instantToWallFields } from "@/server/temporal/zone";
import { searchCandidates, type SearchCandidate } from "@/lib/search";

const MAX_LIMIT = 50;

function isoDate(d: { year: number; month: number; day: number }): string {
  return `${d.year}-${String(d.month + 1).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`;
}

export async function GET(request: Request) {
  return handleErrors(async () => {
    const { userId } = await requireSession();
    const url = new URL(request.url);
    const q = (url.searchParams.get("q") ?? "").trim();
    if (!q) {
      return errorResponse("bad_request", "q is required", 400);
    }
    const limitParam = Number(url.searchParams.get("limit") ?? "25");
    const limit = Number.isFinite(limitParam)
      ? Math.min(Math.max(Math.trunc(limitParam), 1), MAX_LIMIT)
      : 25;

    const [settings, series, tasks] = await Promise.all([
      getOrCreateSettings(userId),
      listActivitySeries(userId),
      listTasks(userId),
    ]);
    const zone = settings.timezone || "UTC";
    const today = isoDate(instantToWallFields(new Date(), zone));

    const repeats = new Map<string, boolean>();
    const candidates: SearchCandidate[] = [];

    for (const s of series) {
      const wall = instantToWallFields(s.dtstartLocal, s.tz || zone);
      repeats.set(s.id, Boolean(s.rrule));
      candidates.push({
        id: s.id,
        kind: "activity",
        title: s.title,
        notes: s.notes,
        emoji: s.emoji,
        date: isoDate(wall),
        startMin: wall.hour * 60 + wall.minute,
        categoryId: s.categoryId,
      });
    }

    for (const t of tasks) {
      candidates.push({
        id: t.id,
        kind: "task",
        title: t.title,
        notes: t.notes,
        emoji: t.emoji,
        // Inbox tasks have no date; anytime tasks carry one.
        date: t.date ? isoDate({
          year: t.date.getUTCFullYear(),
          month: t.date.getUTCMonth(),
          day: t.date.getUTCDate(),
        }) : null,
        startMin: null,
        categoryId: t.categoryId,
        done: Boolean(t.convertedTo),
      });
    }

    const hits = searchCandidates(candidates, q, { today, limit });

    return Response.json(
      {
        query: q,
        today,
        zone,
        items: hits.map((h) => ({
          id: h.id,
          kind: h.kind,
          title: h.title,
          emoji: h.emoji ?? null,
          date: h.date ?? null,
          startMin: h.startMin ?? null,
          categoryId: h.categoryId ?? null,
          matchedOn: h.matchedOn,
          repeats: h.kind === "activity" ? (repeats.get(h.id) ?? false) : false,
        })),
        nextCursor: null,
      },
      { headers: { "cache-control": "private, no-store" } },
    );
  });
}
