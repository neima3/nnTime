import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { catClasses, monthDays as mockMonthDays, type CategoryId } from "@/lib/mock";
import { getSession } from "@/server/auth-session";
import {
  listActivitySeries,
  listCategories,
  getOrCreateSettings,
  listUserOccurrences,
} from "@/server/dal";
import { buildCategoryMap } from "@/lib/adapters";
import { expandActivitiesForDay } from "@/server/services/day";
import { instantToDateStr, resolveDayBounds } from "@/server/temporal/zone";

const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type DayCell = {
  date: number;
  dateStr?: string;
  isToday?: boolean;
  otherMonth?: boolean;
  dots: CategoryId[];
  more?: number;
};

function shiftMonth(year: number, month: number, delta: number) {
  const d = new Date(Date.UTC(year, month + delta, 1));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() };
}

async function loadMonth(year: number, month: number): Promise<{
  days: DayCell[];
  label: string;
  year: number;
  month: number;
  authed: boolean;
}> {
  const session = await getSession();
  const monthLabel = new Date(year, month, 1).toLocaleDateString("en-US", {
    month: "long",
  });

  if (!session) {
    return {
      days: mockMonthDays,
      label: monthLabel,
      year,
      month,
      authed: false,
    };
  }

  const settings = await getOrCreateSettings(session.userId);
  const zone = settings.timezone;
  const todayStr = instantToDateStr(new Date(), zone);
  const series = await listActivitySeries(session.userId);
  const occurrences = await listUserOccurrences(session.userId);
  const categories = await listCategories(session.userId).catch(() => []);
  const categoryMap = buildCategoryMap(
    categories as unknown as Parameters<typeof buildCategoryMap>[0],
  );

  const firstDay = new Date(year, month, 1);
  const startWeekday = (firstDay.getDay() + 6) % 7; // 0=Mon
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevMonthDays = new Date(year, month, 0).getDate();

  // Expand RRULE series per day so recurring blocks show as dots (not only
  // the series dtstart day). Cap at 4 categories for the cell UI.
  const dotsByDay = new Map<number, CategoryId[]>();
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const expanded = expandActivitiesForDay(
      series,
      occurrences,
      resolveDayBounds(dateStr, zone),
    );
    const cats: CategoryId[] = [];
    for (const s of expanded) {
      if (cats.length >= 4) break;
      cats.push(
        s.categoryId ? categoryMap.get(s.categoryId) ?? "sky" : "sky",
      );
    }
    if (cats.length) dotsByDay.set(d, cats);
  }

  const result: DayCell[] = [];
  for (let i = startWeekday - 1; i >= 0; i--) {
    result.push({ date: prevMonthDays - i, otherMonth: true, dots: [] });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const dots = dotsByDay.get(d) ?? [];
    result.push({
      date: d,
      dateStr,
      isToday: dateStr === todayStr,
      dots: dots.slice(0, 3),
      more: dots.length > 3 ? dots.length - 3 : undefined,
    });
  }
  while (result.length % 7 !== 0) {
    result.push({
      date: result.length - daysInMonth - startWeekday + 1,
      otherMonth: true,
      dots: [],
    });
  }

  return { days: result, label: monthLabel, year, month, authed: true };
}

export default async function MonthPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth();
  if (typeof sp.ym === "string" && /^\d{4}-\d{2}$/.test(sp.ym)) {
    const [y, m] = sp.ym.split("-").map(Number);
    year = y!;
    month = m! - 1;
  }

  const { days, label } = await loadMonth(year, month);
  const prev = shiftMonth(year, month, -1);
  const next = shiftMonth(year, month, 1);
  const prevYm = `${prev.year}-${String(prev.month + 1).padStart(2, "0")}`;
  const nextYm = `${next.year}-${String(next.month + 1).padStart(2, "0")}`;

  return (
    <AppShell active="week">
      <div className="mx-auto max-w-5xl px-4 py-6 md:px-8">
        <header className="mb-6 flex flex-wrap items-center gap-3">
          <div className="mr-auto">
            <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-iris">
              {year}
            </p>
            <h1 className="font-display text-3xl font-bold tracking-tight">
              {label}
            </h1>
          </div>
          <div className="flex items-center rounded-2xl border border-border bg-surface p-1 shadow-card">
            <Link
              href="/app/week"
              className="rounded-xl px-3.5 py-1.5 text-sm font-semibold text-ink-soft hover:text-ink"
            >
              Week
            </Link>
            <span className="rounded-xl bg-iris-soft px-3.5 py-1.5 text-sm font-semibold text-iris">
              Month
            </span>
          </div>
          <div className="flex items-center gap-1 rounded-2xl border border-border bg-surface p-1 shadow-card">
            <Link
              href={`/app/month?ym=${prevYm}`}
              aria-label="Previous month"
              className="grid size-9 place-items-center rounded-xl text-ink-soft hover:bg-surface-sunken"
            >
              <ChevronLeft size={18} />
            </Link>
            <Link
              href="/app/month"
              className="rounded-xl px-3 py-1.5 text-sm font-semibold text-iris hover:bg-iris-ghost"
            >
              This month
            </Link>
            <Link
              href={`/app/month?ym=${nextYm}`}
              aria-label="Next month"
              className="grid size-9 place-items-center rounded-xl text-ink-soft hover:bg-surface-sunken"
            >
              <ChevronRight size={18} />
            </Link>
          </div>
        </header>

        <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
          {weekdays.map((w) => (
            <div
              key={w}
              className="px-1 pb-1 text-center text-[11px] font-bold uppercase tracking-wide text-ink-faint"
            >
              {w}
            </div>
          ))}
          {days.map((d, i) => {
            const inner = (
              <>
                <span
                  className={`tnum text-[13px] font-bold ${
                    d.isToday ? "text-iris" : d.otherMonth ? "text-ink-faint" : ""
                  }`}
                >
                  {d.date}
                </span>
                <div className="mt-1.5 flex flex-wrap gap-0.5">
                  {d.dots.map((c, j) => (
                    <span
                      key={j}
                      className={`size-1.5 rounded-full ${catClasses[c].dot}`}
                    />
                  ))}
                  {d.more ? (
                    <span className="text-[9px] font-bold text-ink-faint">
                      +{d.more}
                    </span>
                  ) : null}
                </div>
              </>
            );
            const cls = `min-h-16 rounded-2xl border p-2 transition-colors ${
              d.isToday
                ? "border-iris bg-iris-ghost shadow-card"
                : d.otherMonth
                  ? "border-transparent bg-transparent"
                  : "border-border bg-surface hover:bg-surface-raised"
            }`;
            if (d.dateStr && !d.otherMonth) {
              return (
                <Link key={i} href={`/app/today?date=${d.dateStr}`} className={cls}>
                  {inner}
                </Link>
              );
            }
            return (
              <div key={i} className={cls}>
                {inner}
              </div>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}
