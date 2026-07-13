import { Flame, Pencil } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { statWeek } from "@/lib/mock";

/* Design reference: Stats/insights + mood check-in (Phase 5C).
   Data rules: iris = primary series; category pastels only for categories;
   never red; gentle copy — numbers describe, they don't judge. */

const days = ["M", "T", "W", "T", "F", "S", "S"];

function Card({
  title,
  hint,
  children,
  wide,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <section
      className={`rounded-3xl border border-border bg-surface p-5 shadow-card ${
        wide ? "sm:col-span-2" : ""
      }`}
    >
      <h2 className="font-display text-base font-bold">{title}</h2>
      {hint && <p className="mt-0.5 text-[12.5px] text-ink-soft">{hint}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function BarRow({ values, unit, max }: { values: number[]; unit: string; max: number }) {
  return (
    <div className="flex items-end justify-between gap-2">
      {values.map((v, i) => (
        <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
          <span className="tnum text-[10.5px] font-semibold text-ink-faint">
            {v > 0 ? `${v}${unit}` : "·"}
          </span>
          <div className="flex h-24 w-full items-end rounded-lg bg-surface-sunken">
            <div
              className={`w-full rounded-lg ${i === 5 ? "bg-iris" : "bg-iris/45"}`}
              style={{ height: `${Math.max((v / max) * 100, v > 0 ? 8 : 0)}%` }}
            />
          </div>
          <span
            className={`text-[11px] font-bold ${
              i === 5 ? "text-iris" : "text-ink-faint"
            }`}
          >
            {days[i]}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function StatsPage() {
  const { completion, focusMin, energy, moods, streak } = statWeek;
  const totalFocus = focusMin.reduce((a, b) => a + b, 0);
  const energyTotal = energy.low + energy.medium + energy.high;

  return (
    <AppShell active="stats">
      <div className="mx-auto max-w-3xl px-4 py-6 md:px-8">
        <header className="mb-6 flex flex-wrap items-center gap-3">
          <div className="mr-auto">
            <h1 className="font-display text-3xl font-bold tracking-tight">
              Your week
            </h1>
            <p className="mt-1 text-[14px] text-ink-soft">
              July 6 – 12 · numbers are a mirror, not a report card.
            </p>
          </div>
          <div className="flex items-center rounded-2xl border border-border bg-surface p-1 shadow-card">
            <span className="rounded-xl bg-iris-soft px-3.5 py-1.5 text-sm font-semibold text-iris">
              Week
            </span>
            <button className="rounded-xl px-3.5 py-1.5 text-sm font-semibold text-ink-soft hover:text-ink">
              Month
            </button>
          </div>
        </header>

        <div className="grid gap-4 sm:grid-cols-2">
          <Card title="Plans completed" hint="4 of 10 so far today — the week so far:">
            <BarRow values={completion} unit="%" max={100} />
          </Card>

          <Card title="Focused time" hint={`${Math.floor(totalFocus / 60)} h ${totalFocus % 60} min this week`}>
            <BarRow values={focusMin} unit="m" max={120} />
          </Card>

          <Card title="Energy balance" hint="How you tagged your activities">
            <div className="flex h-4 w-full overflow-hidden rounded-full">
              <div
                className="bg-cat-mint"
                style={{ width: `${(energy.low / energyTotal) * 100}%` }}
              />
              <div
                className="bg-cat-butter"
                style={{ width: `${(energy.medium / energyTotal) * 100}%` }}
              />
              <div
                className="bg-cat-rose"
                style={{ width: `${(energy.high / energyTotal) * 100}%` }}
              />
            </div>
            <div className="mt-3 flex justify-between text-[12.5px] font-semibold">
              <span className="text-cat-mint-ink">● Low {energy.low}</span>
              <span className="text-cat-butter-ink">● Medium {energy.medium}</span>
              <span className="text-cat-rose-ink">● High {energy.high}</span>
            </div>
            <p className="mt-3 rounded-xl bg-surface-sunken px-3 py-2 text-[12.5px] leading-snug text-ink-soft">
              Heavier on medium this week — your Thursday had three
              high-energy blocks back-to-back. Worth spacing out?
            </p>
          </Card>

          <Card title="Streak" hint="A day counts when you complete any planned thing">
            <div className="flex items-center gap-4">
              <span className="grid size-16 place-items-center rounded-2xl bg-iris-soft">
                <Flame size={28} className="text-iris" />
              </span>
              <div>
                <p className="font-display text-3xl font-bold leading-none">
                  {streak.current} days
                </p>
                <p className="mt-1 text-[13px] font-medium text-ink-soft">
                  gentle streak · best: {streak.best}
                </p>
              </div>
            </div>
            <p className="mt-4 rounded-xl bg-surface-sunken px-3 py-2 text-[12.5px] leading-snug text-ink-soft">
              Missing a day pauses the flame, it never burns it down. One-day
              grace is built in.
            </p>
          </Card>

          <Card title="Mood check-ins" hint="A tap in the morning and evening — see patterns, not scores" wide>
            <div className="flex items-center justify-between gap-2">
              {moods.map((m, i) => (
                <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
                  <span
                    className={`grid size-11 place-items-center rounded-full text-xl ${
                      m ? "bg-surface-sunken" : "border-2 border-dashed border-border-strong"
                    }`}
                    aria-label={m ? `Mood day ${i + 1}` : "No check-in"}
                  >
                    {m ?? ""}
                  </span>
                  <span
                    className={`text-[11px] font-bold ${
                      i === 5 ? "text-iris" : "text-ink-faint"
                    }`}
                  >
                    {days[i]}
                  </span>
                </div>
              ))}
            </div>
            {/* today's check-in affordance */}
            <div className="mt-5 flex items-center gap-3 rounded-2xl border border-border bg-surface-raised px-4 py-3">
              <p className="mr-auto text-[14px] font-semibold">
                How&apos;s this evening feeling?
              </p>
              <div className="flex gap-1">
                {["😖", "😮‍💨", "🙂", "😌", "😄"].map((f) => (
                  <button
                    key={f}
                    className="grid size-10 place-items-center rounded-full text-xl transition-transform hover:scale-110 hover:bg-iris-ghost"
                    aria-label={`Mood ${f}`}
                  >
                    {f}
                  </button>
                ))}
              </div>
              <button
                aria-label="Add note"
                className="grid size-9 place-items-center rounded-xl text-ink-faint hover:bg-surface-sunken hover:text-ink"
              >
                <Pencil size={15} />
              </button>
            </div>
          </Card>

          <Card title="Gentle wins" wide>
            <ul className="grid gap-2 text-[14px] font-medium sm:grid-cols-3">
              <li className="rounded-2xl bg-cat-butter px-4 py-3 text-cat-butter-ink">
                🌤️ Morning reset: 7 for 7
              </li>
              <li className="rounded-2xl bg-cat-lilac px-4 py-3 text-cat-lilac-ink">
                🎯 Longest focus: 2 h Tue
              </li>
              <li className="rounded-2xl bg-cat-mint px-4 py-3 text-cat-mint-ink">
                🚶 Every walk happened
              </li>
            </ul>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
