import { AppShell } from "@/components/AppShell";
import { ReviewClient, type ReviewItem } from "@/components/ReviewClient";
import {
  reviewItems as mockReviewItems,
  type CategoryId,
} from "@/lib/mock";
import { getResolvedDay } from "@/server/services/day";
import { getOrCreateSettings, listCategories } from "@/server/dal";
import {
  buildCategoryMap,
  dateToMinutesFromMidnight,
} from "@/lib/adapters";
import { instantToDateStr } from "@/server/temporal/zone";
import { formatTime, toHourCycle } from "@/lib/time-format";
import { partitionReviewItems } from "@/lib/review-window";

async function loadReview(): Promise<{
  items: ReviewItem[];
  /** Pending blocks still ahead of now — counted, never judged. */
  upcoming: number;
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
      upcoming: 0,
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

  const settings = await getOrCreateSettings(resolved.userId).catch(() => null);
  const hourCycle = toHourCycle(settings?.hourCycle);

  const categories = await listCategories(resolved.userId).catch(() => []);
  const categoryMap = buildCategoryMap(
    categories as unknown as Parameters<typeof buildCategoryMap>[0],
  );

  const items: ReviewItem[] = resolved.activities
    .map((s) => {
      if (
        s.status === "completed" ||
        s.status === "skipped" ||
        s.status === "cancelled"
      ) {
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
        time: `${formatTime(startMin, hourCycle)} – ${formatTime(startMin + s.durationMin, hourCycle)}`,
        revision: s.revision,
        occurrenceKey: s.occurrenceKey.toISOString(),
        startMin,
        durationMin: s.durationMin,
      } satisfies ReviewItem;
    })
    .filter((x): x is ReviewItem => x !== null);

  // Opening Review at 2 pm must not list tonight's plan as "didn't happen".
  const isToday = resolved.date === instantToDateStr(new Date(), resolved.zone);
  const { past, upcoming } = partitionReviewItems(
    items,
    isToday ? dateToMinutesFromMidnight(new Date(), resolved.zone) : null,
  );

  return {
    items: past,
    upcoming,
    date: resolved.date,
    zone: resolved.zone,
    authed: true,
  };
}

export default async function ReviewPage() {
  const { items, upcoming, date, zone, authed } = await loadReview();
  return (
    <AppShell active="today">
      <ReviewClient
        items={items}
        upcoming={upcoming}
        date={date}
        zone={zone}
        authed={authed}
      />
    </AppShell>
  );
}
