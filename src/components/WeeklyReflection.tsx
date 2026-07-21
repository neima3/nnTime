"use client";

/**
 * Weekly Reflection (P13 — gentle patterns digest).
 *
 * Notices, never grades. Turns the fortnight of stats the page already has
 * into two or three warm, present-tense observations: which weekday tends to
 * be yours, how much focus you gave, when your attention peaks. Only appears
 * once there's enough to notice — quiet weeks are left in peace.
 */

const WEEKDAYS = [
  "Sundays",
  "Mondays",
  "Tuesdays",
  "Wednesdays",
  "Thursdays",
  "Fridays",
  "Saturdays",
];

function hourLabel(h: number) {
  if (h === 0) return "midnight";
  if (h === 12) return "noon";
  const period = h < 12 ? "am" : "pm";
  const twelve = h % 12 === 0 ? 12 : h % 12;
  return `${twelve}${period}`;
}

export function WeeklyReflection({
  byDate,
  totalCompleted,
  totalFocusMin,
  peakHour,
}: {
  byDate: Record<string, { completed: number; focusMin: number; mood: string | null }>;
  totalCompleted: number;
  totalFocusMin: number;
  peakHour: number | null;
}) {
  // Not enough signal yet — leave quiet weeks alone.
  if (totalCompleted < 3) return null;

  const notes: string[] = [];

  // Which weekday tends to be theirs (by completions).
  const byWeekday = new Array(7).fill(0);
  let activeDays = 0;
  for (const [key, v] of Object.entries(byDate)) {
    if (v.completed > 0) {
      activeDays++;
      const d = new Date(key + "T00:00:00");
      byWeekday[d.getDay()] += v.completed;
    }
  }
  const bestDow = byWeekday.indexOf(Math.max(...byWeekday));
  if (byWeekday[bestDow] >= 2) {
    notes.push(
      `${WEEKDAYS[bestDow]} tend to be yours — that's where the most got finished.`,
    );
  }

  // Focus given.
  if (totalFocusMin >= 25) {
    const h = Math.round(totalFocusMin / 6) / 10;
    notes.push(
      `You gave about ${h < 1 ? `${totalFocusMin} focused minutes` : `${h} focused hours`} — time you chose to spend on what mattered.`,
    );
  }

  // Peak attention window.
  if (peakHour != null) {
    notes.push(
      `Your attention lands most around ${hourLabel(peakHour)}. Worth guarding for the hard things.`,
    );
  }

  // Showing up.
  if (activeDays >= 4) {
    notes.push(
      `You showed up on ${activeDays} different days. Consistency, the forgiving kind.`,
    );
  }

  if (notes.length === 0) return null;
  const shown = notes.slice(0, 3);

  return (
    <section className="rounded-3xl border border-border bg-surface p-5 shadow-card sm:col-span-2">
      <h2 className="font-display text-base font-bold">This fortnight, gently</h2>
      <p className="mt-0.5 text-[12.5px] text-ink-soft">
        Patterns worth noticing — nothing to fix
      </p>
      <ul className="mt-4 space-y-2.5">
        {shown.map((note, i) => (
          <li key={i} className="flex gap-2.5 text-[14px] leading-relaxed">
            <span aria-hidden className="mt-0.5 text-iris">
              ·
            </span>
            <span>{note}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
