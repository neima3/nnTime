import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { catClasses, monthDays as mockMonthDays, type CategoryId } from "@/lib/mock";
import { getSession } from "@/server/auth-session";
import { listActivitySeries, listCategories } from "@/server/dal";
import { buildCategoryMap } from "@/lib/adapters";

const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Load real month data or fall back to mock when logged out. */
async function loadMonth() {
  const session = await getSession();
  if (!session) return mockMonthDays;
  const series = await listActivitySeries(session.userId);
  const categories = await listCategories(session.userId).catch(() => []);
  const categoryMap = buildCategoryMap(categories as unknown as Parameters<typeof buildCategoryMap>[0]);

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const firstDay = new Date(year, month, 1);
  const startWeekday = (firstDay.getDay() + 6) % 7; // 0=Mon
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevMonthDays = new Date(year, month, 0).getDate();

  // Map activity series to dates in this month.
  const dotsByDay = new Map<number, CategoryId[]>();
  for (const s of series) {
    const d = s.dtstartLocal;
    if (d.getFullYear() === year && d.getMonth() === month) {
      const day = d.getDate();
      const cat = s.categoryId ? categoryMap.get(s.categoryId) ?? "sky" : "sky";
      const existing = dotsByDay.get(day) ?? [];
      if (existing.length < 3) existing.push(cat);
      dotsByDay.set(day, existing);
    }
  }

  const result: { date: number; isToday?: boolean; otherMonth?: boolean; dots: CategoryId[]; more?: number }[] = [];
  // Leading days from prev month.
  for (let i = startWeekday - 1; i >= 0; i--) {
    result.push({ date: prevMonthDays - i, otherMonth: true, dots: [] });
  }
  // Current month days.
  for (let d = 1; d <= daysInMonth; d++) {
    const dots = dotsByDay.get(d) ?? [];
    result.push({
      date: d,
      isToday: d === now.getDate(),
      dots: dots.slice(0, 3),
      more: dots.length > 3 ? dots.length - 3 : undefined,
    });
  }
  // Trailing days to fill the grid.
  while (result.length % 7 !== 0) {
    result.push({ date: result.length - daysInMonth - startWeekday + 1, otherMonth: true, dots: [] });
  }
  return result;
}

export default async function MonthPage() {
  const monthDays = await loadMonth();
  return (
    <AppShell active="week">
      <div className="mx-auto max-w-5xl px-4 py-6 md:px-8">
        <header className="mb-6 flex flex-wrap items-center gap-3">
          <div className="mr-auto">
            <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-iris">
              2026
            </p>
            <h1 className="font-display text-3xl font-bold tracking-tight">July</h1>
          </div>
          {/* week/month toggle — lives on both views */}
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
            <button aria-label="Previous month" className="grid size-9 place-items-center rounded-xl text-ink-soft hover:bg-surface-sunken">
              <ChevronLeft size={18} />
            </button>
            <button className="rounded-xl px-3 py-1.5 text-sm font-semibold text-iris hover:bg-iris-ghost">
              This month
            </button>
            <button aria-label="Next month" className="grid size-9 place-items-center rounded-xl text-ink-soft hover:bg-surface-sunken">
              <ChevronRight size={18} />
            </button>
          </div>
        </header>

        <div className="overflow-hidden rounded-3xl border border-border bg-surface shadow-card">
          <div className="grid grid-cols-7 border-b border-border bg-surface-raised">
            {weekdays.map((d, i) => (
              <p
                key={d}
                className={`py-2.5 text-center text-[12px] font-bold uppercase tracking-wide ${
                  i >= 5 ? "text-ink-faint" : "text-ink-soft"
                }`}
              >
                {d}
              </p>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {monthDays.map((d, i) => {
              const weekend = i % 7 >= 5;
              return (
                <button
                  key={i}
                  className={`group relative flex aspect-square flex-col items-center justify-center gap-1.5 border-b border-r border-border p-1 transition-colors [&:nth-child(7n)]:border-r-0 sm:aspect-[4/3] ${
                    d.otherMonth
                      ? "bg-surface-sunken/50"
                      : weekend
                        ? "bg-surface-sunken/25 hover:bg-iris-ghost"
                        : "hover:bg-iris-ghost"
                  }`}
                  aria-label={`July ${d.date}`}
                >
                  <span
                    className={`tnum grid size-8 place-items-center rounded-full text-[15px] font-semibold ${
                      d.isToday
                        ? "bg-iris font-bold text-ink-inverse shadow-card"
                        : d.otherMonth
                          ? "text-ink-faint"
                          : ""
                    }`}
                  >
                    {d.date}
                  </span>
                  <span className="flex h-2 items-center gap-1">
                    {d.dots.map((c, j) => (
                      <span
                        key={j}
                        className={`size-1.5 rounded-full ${catClasses[c].dot} ${
                          d.otherMonth ? "opacity-40" : ""
                        }`}
                      />
                    ))}
                    {d.more && (
                      <span className="text-[10px] font-bold text-ink-faint">
                        +{d.more}
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <p className="mt-4 text-[13px] text-ink-soft">
          Dots are category colors (max 3 + overflow count). Tapping a day opens
          that day&apos;s timeline (<code className="rounded bg-surface-sunken px-1 text-[12px]">/app/day/[date]</code>).
        </p>
      </div>
    </AppShell>
  );
}
