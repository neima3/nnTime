import { AppShell } from "@/components/AppShell";
import { ReviewClient, type ReviewItem } from "@/components/ReviewClient";
import {
  reviewItems as mockReviewItems,
  fmt,
  type CategoryId,
} from "@/lib/mock";
import { getResolvedDay } from "@/server/services/day";
import { listCategories } from "@/server/dal";
import {
  buildCategoryMap,
  dateToMinutesFromMidnight,
  seriesToActivity,
} from "@/lib/adapters";
import { instantToDateStr } from "@/server/temporal/zone";

async function loadReview(): Promise<{
  items: ReviewItem[];
  date: string;
  zone: string;
  authed: boolean;
}> {
  const zoneGuess = "UTC";
  const today = instantToDateStr(new Date(), zoneGuess);
  const resolved = await getResolvedDay();
  if (!resolved) {
    return {
      authed: false,
      date: today,
      zone: zoneGuess,
      items: mockReviewItems.map((r, i) => ({
        id: r.id,
        title: r.title,
        emoji: r.emoji,
        category: r.category,
        time: r.time,
        revision: 1,
        occurrenceKey: new Date().toISOString(),
        startMin: 9 * 60 + i * 30,
        durationMin: 30,
        checklist: r.checklist,
      })),
    };
  }

  const categories = await listCategories(resolved.userId).catch(() => []);
  const categoryMap = buildCategoryMap(
    categories as unknown as Parameters<typeof buildCategoryMap>[0],
  );

  const items: ReviewItem[] = (
    resolved.activities as Parameters<typeof seriesToActivity>[0][]
  )
    .map((s) => {
      const status = resolved.occurrenceStatusBySeries[s.id];
      if (status === "completed" || status === "skipped" || status === "cancelled") {
        return null;
      }
      const startMin = dateToMinutesFromMidnight(s.dtstartLocal, resolved.zone);
      const cat = (s.categoryId
        ? categoryMap.get(s.categoryId) ?? "sky"
        : "sky") as CategoryId;
      return {
        id: s.id,
        title: s.title,
        emoji: s.emoji ?? "📋",
        category: cat,
        time: `${fmt(startMin)} – ${fmt(startMin + s.durationMin)}`,
        revision: s.revision,
        occurrenceKey: s.dtstartLocal.toISOString(),
        startMin,
        durationMin: s.durationMin,
      } satisfies ReviewItem;
    })
    .filter((x): x is ReviewItem => x !== null);

  return {
    items,
    date: resolved.date,
    zone: resolved.zone,
    authed: true,
  };
}

export default async function ReviewPage() {
  const { items, date, zone, authed } = await loadReview();
  return (
    <AppShell active="today">
      <ReviewClient items={items} date={date} zone={zone} authed={authed} />
    </AppShell>
  );
}
