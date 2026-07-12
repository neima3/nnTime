import { ChevronLeft, ChevronRight } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { catClasses, type CategoryId } from "@/lib/mock";

type Block = { emoji: string; title: string; time: string; category: CategoryId };

const week: { day: string; date: number; isToday?: boolean; blocks: Block[] }[] = [
  {
    day: "Mon",
    date: 7,
    blocks: [
      { emoji: "🌤️", title: "Morning reset", time: "8:00", category: "butter" },
      { emoji: "🎯", title: "Deep work", time: "9:30", category: "lilac" },
      { emoji: "💊", title: "Shift", time: "14:00", category: "sky" },
    ],
  },
  {
    day: "Tue",
    date: 8,
    blocks: [
      { emoji: "🌤️", title: "Morning reset", time: "8:00", category: "butter" },
      { emoji: "💊", title: "Shift", time: "9:00", category: "sky" },
      { emoji: "🌙", title: "Wind down", time: "21:30", category: "lilac" },
    ],
  },
  {
    day: "Wed",
    date: 9,
    blocks: [
      { emoji: "🎯", title: "Deep work", time: "9:30", category: "lilac" },
      { emoji: "🏋️", title: "Gym", time: "17:00", category: "mint" },
    ],
  },
  {
    day: "Thu",
    date: 10,
    blocks: [
      { emoji: "💊", title: "Shift", time: "9:00", category: "sky" },
      { emoji: "📞", title: "Call mom", time: "18:00", category: "rose" },
    ],
  },
  {
    day: "Fri",
    date: 11,
    blocks: [
      { emoji: "🎯", title: "Deep work", time: "9:30", category: "lilac" },
      { emoji: "🍕", title: "Movie night", time: "19:30", category: "peach" },
    ],
  },
  {
    day: "Sat",
    date: 12,
    isToday: true,
    blocks: [
      { emoji: "🌤️", title: "Morning reset", time: "8:00", category: "butter" },
      { emoji: "🎨", title: "Kairo design", time: "9:30", category: "lilac" },
      { emoji: "💊", title: "Shift prep", time: "13:30", category: "sky" },
      { emoji: "🏋️", title: "Gym", time: "17:00", category: "mint" },
    ],
  },
  {
    day: "Sun",
    date: 13,
    blocks: [
      { emoji: "🧺", title: "Sunday reset", time: "11:00", category: "sky" },
      { emoji: "🥘", title: "Meal prep", time: "16:00", category: "peach" },
    ],
  },
];

export default function WeekPage() {
  return (
    <AppShell active="week">
      <div className="mx-auto max-w-6xl px-4 py-6 md:px-8">
        <header className="mb-6 flex flex-wrap items-center gap-3">
          <div className="mr-auto">
            <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-iris">
              Week 28
            </p>
            <h1 className="font-display text-3xl font-bold tracking-tight">
              July 7 – 13
            </h1>
          </div>
          <div className="flex items-center gap-1 rounded-2xl border border-border bg-surface p-1 shadow-card">
            <button aria-label="Previous week" className="grid size-9 place-items-center rounded-xl text-ink-soft hover:bg-surface-sunken">
              <ChevronLeft size={18} />
            </button>
            <button className="rounded-xl px-3 py-1.5 text-sm font-semibold text-iris hover:bg-iris-ghost">
              This week
            </button>
            <button aria-label="Next week" className="grid size-9 place-items-center rounded-xl text-ink-soft hover:bg-surface-sunken">
              <ChevronRight size={18} />
            </button>
          </div>
        </header>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {week.map((d) => (
            <section
              key={d.day}
              className={`flex flex-col gap-2 rounded-3xl border p-3 ${
                d.isToday
                  ? "border-iris bg-iris-ghost shadow-card"
                  : "border-border bg-surface"
              }`}
            >
              <header className="flex items-baseline justify-between px-1">
                <span
                  className={`text-[13px] font-bold uppercase tracking-wide ${
                    d.isToday ? "text-iris" : "text-ink-soft"
                  }`}
                >
                  {d.day}
                </span>
                <span
                  className={`tnum font-display text-lg font-bold ${
                    d.isToday ? "text-iris" : ""
                  }`}
                >
                  {d.date}
                </span>
              </header>
              {d.blocks.map((b) => {
                const cat = catClasses[b.category];
                return (
                  <div
                    key={b.title + b.time}
                    className={`flex items-center gap-2 rounded-xl px-2.5 py-2 ${cat.fill}`}
                  >
                    <span className="text-sm" aria-hidden>
                      {b.emoji}
                    </span>
                    <div className="min-w-0">
                      <p className={`truncate text-[12.5px] font-semibold leading-tight ${cat.ink}`}>
                        {b.title}
                      </p>
                      <p className={`tnum text-[11px] font-medium ${cat.ink} opacity-70`}>
                        {b.time}
                      </p>
                    </div>
                  </div>
                );
              })}
            </section>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
