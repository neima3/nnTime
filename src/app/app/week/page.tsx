import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { catClasses, fmt, type CategoryId } from "@/lib/mock";
import { getSession } from "@/server/auth-session";
import { listActivitySeries, listCategories, getOrCreateSettings } from "@/server/dal";
import { buildCategoryMap, dateToMinutesFromMidnight } from "@/lib/adapters";
import { instantToDateStr } from "@/server/temporal/zone";

type Block = {
  id: string;
  emoji: string;
  title: string;
  time: string;
  category: CategoryId;
};

type DayCol = {
  day: string;
  date: number;
  dateStr: string;
  isToday?: boolean;
  blocks: Block[];
};

const mockWeek: DayCol[] = [
  {
    day: "Mon",
    date: 7,
    dateStr: "2026-07-07",
    blocks: [
      { id: "m1", emoji: "🌤️", title: "Morning reset", time: "8:00", category: "butter" },
      { id: "m2", emoji: "🎯", title: "Deep work", time: "9:30", category: "lilac" },
    ],
  },
  {
    day: "Tue",
    date: 8,
    dateStr: "2026-07-08",
    blocks: [
      { id: "m3", emoji: "💊", title: "Shift", time: "9:00", category: "sky" },
    ],
  },
  {
    day: "Wed",
    date: 9,
    dateStr: "2026-07-09",
    blocks: [
      { id: "m4", emoji: "🏋️", title: "Gym", time: "17:00", category: "mint" },
    ],
  },
  {
    day: "Thu",
    date: 10,
    dateStr: "2026-07-10",
    blocks: [],
  },
  {
    day: "Fri",
    date: 11,
    dateStr: "2026-07-11",
    blocks: [
      { id: "m5", emoji: "🎯", title: "Deep work", time: "9:30", category: "lilac" },
    ],
  },
  {
    day: "Sat",
    date: 12,
    dateStr: "2026-07-12",
    isToday: true,
    blocks: [
      { id: "m6", emoji: "💊", title: "Shift prep", time: "13:30", category: "sky" },
    ],
  },
  {
    day: "Sun",
    date: 13,
    dateStr: "2026-07-13",
    blocks: [
      { id: "m7", emoji: "🥘", title: "Meal prep", time: "16:00", category: "peach" },
    ],
  },
];

function shiftDate(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d! + days)).toISOString().slice(0, 10);
}

/** Monday of the week containing dateStr (ISO Monday-start). */
function mondayOf(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!));
  const dow = dt.getUTCDay(); // 0=Sun
  const offset = dow === 0 ? -6 : 1 - dow;
  return shiftDate(dateStr, offset);
}

async function loadWeek(weekParam?: string) {
  const session = await getSession();
  if (!session) return { days: mockWeek, label: "July 7 – 13", weekStart: "2026-07-07" };

  const settings = await getOrCreateSettings(session.userId);
  const zone = settings.timezone;
  const todayStr = instantToDateStr(new Date(), zone);
  const weekStart = mondayOf(weekParam && /^\d{4}-\d{2}-\d{2}$/.test(weekParam) ? weekParam : todayStr);

  const series = await listActivitySeries(session.userId);
  const categories = await listCategories(session.userId).catch(() => []);
  const categoryMap = buildCategoryMap(
    categories as unknown as Parameters<typeof buildCategoryMap>[0],
  );

  const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const days: DayCol[] = [];
  for (let i = 0; i < 7; i++) {
    const dateStr = shiftDate(weekStart, i);
    const dayBlocks: Block[] = series
      .filter((s) => {
        try {
          return instantToDateStr(s.dtstartLocal, s.tz || zone) === dateStr;
        } catch {
          return false;
        }
      })
      .map((s) => {
        const startMin = dateToMinutesFromMidnight(s.dtstartLocal, zone);
        const cat = s.categoryId
          ? categoryMap.get(s.categoryId) ?? "sky"
          : "sky";
        return {
          id: s.id,
          emoji: s.emoji ?? "📋",
          title: s.title,
          time: fmt(startMin),
          category: cat,
        };
      });
    days.push({
      day: dayNames[i]!,
      date: Number(dateStr.slice(8, 10)),
      dateStr,
      isToday: dateStr === todayStr,
      blocks: dayBlocks,
    });
  }

  const end = shiftDate(weekStart, 6);
  const label = `${weekStart.slice(5).replace("-", "/")} – ${end.slice(5).replace("-", "/")}`;
  return { days, label, weekStart };
}

export default async function WeekPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const weekParam = typeof sp.week === "string" ? sp.week : undefined;
  const { days, label, weekStart } = await loadWeek(weekParam);
  const prev = shiftDate(weekStart, -7);
  const next = shiftDate(weekStart, 7);

  return (
    <AppShell active="week">
      <div className="mx-auto max-w-6xl px-4 py-6 md:px-8">
        <header className="mb-6 flex flex-wrap items-center gap-3">
          <div className="mr-auto">
            <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-iris">
              Week
            </p>
            <h1 className="font-display text-3xl font-bold tracking-tight">
              {label}
            </h1>
            <p className="tnum mt-0.5 text-[13px] font-medium text-ink-soft">
              {days.reduce((n, d) => n + d.blocks.length, 0)} planned this week
            </p>
          </div>
          <div className="flex items-center rounded-2xl border border-border bg-surface p-1 shadow-card">
            <span className="rounded-xl bg-iris-soft px-3.5 py-1.5 text-sm font-semibold text-iris">
              Week
            </span>
            <Link
              href="/app/month"
              className="rounded-xl px-3.5 py-1.5 text-sm font-semibold text-ink-soft hover:text-ink"
            >
              Month
            </Link>
          </div>
          <div className="flex items-center gap-1 rounded-2xl border border-border bg-surface p-1 shadow-card">
            <Link
              href={`/app/week?week=${prev}`}
              aria-label="Previous week"
              className="grid size-9 place-items-center rounded-xl text-ink-soft hover:bg-surface-sunken focus-visible:ring-2 focus-visible:ring-iris focus-visible:outline-none"
            >
              <ChevronLeft size={18} />
            </Link>
            <Link
              href="/app/week"
              className="rounded-xl px-3 py-1.5 text-sm font-semibold text-iris hover:bg-iris-ghost focus-visible:ring-2 focus-visible:ring-iris focus-visible:outline-none"
            >
              This week
            </Link>
            <Link
              href={`/app/week?week=${next}`}
              aria-label="Next week"
              className="grid size-9 place-items-center rounded-xl text-ink-soft hover:bg-surface-sunken focus-visible:ring-2 focus-visible:ring-iris focus-visible:outline-none"
            >
              <ChevronRight size={18} />
            </Link>
          </div>
        </header>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {days.map((d) => (
            <section
              key={d.dateStr}
              className={`group flex min-h-44 flex-col gap-2 rounded-3xl border p-3 transition-shadow hover:shadow-card lg:min-h-64 ${
                d.isToday
                  ? "border-iris bg-iris-ghost shadow-card"
                  : "border-border bg-surface"
              }`}
            >
              <header className="flex items-baseline justify-between px-1">
                <Link
                  href={`/app/today?date=${d.dateStr}`}
                  className={`text-[13px] font-bold uppercase tracking-wide hover:underline focus-visible:ring-2 focus-visible:ring-iris focus-visible:outline-none ${
                    d.isToday ? "text-iris" : "text-ink-soft"
                  }`}
                >
                  {d.day}
                </Link>
                <Link
                  href={`/app/today?date=${d.dateStr}`}
                  className={`tnum font-display text-lg font-bold focus-visible:ring-2 focus-visible:ring-iris focus-visible:outline-none ${
                    d.isToday ? "text-iris" : ""
                  }`}
                >
                  {d.date}
                </Link>
              </header>
              {d.blocks.map((b) => {
                const cat = catClasses[b.category];
                return (
                  <Link
                    key={b.id}
                    href={`/app/editor?id=${b.id}&date=${d.dateStr}`}
                    className={`flex items-center gap-2 rounded-xl px-2.5 py-2 ${cat.fill} focus-visible:ring-2 focus-visible:ring-iris focus-visible:outline-none`}
                  >
                    <span className="text-sm" aria-hidden>
                      {b.emoji}
                    </span>
                    <div className="min-w-0">
                      <p
                        className={`truncate text-[12.5px] font-semibold leading-tight ${cat.ink}`}
                      >
                        {b.title}
                      </p>
                      <p
                        className={`tnum text-[11px] font-medium ${cat.ink} opacity-70`}
                      >
                        {b.time}
                      </p>
                    </div>
                  </Link>
                );
              })}
              {d.blocks.length === 0 ? (
                <Link
                  href={`/app/editor?date=${d.dateStr}&start=${9 * 60}`}
                  className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-border px-2 py-3 text-[11px] font-semibold text-ink-faint transition-colors hover:border-border-strong hover:text-ink-soft"
                >
                  + Add
                </Link>
              ) : (
                <Link
                  href={`/app/editor?date=${d.dateStr}&start=${9 * 60}`}
                  className="mt-auto rounded-xl px-2 py-1.5 text-center text-[11px] font-semibold text-ink-faint transition-opacity hover:text-ink-soft md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
                >
                  + Add
                </Link>
              )}
            </section>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
