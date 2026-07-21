"use client";

/**
 * Weekly Reflection (P13 — gentle patterns digest).
 *
 * Notices, never grades. Turns the fortnight of stats the page already has
 * into two or three warm, present-tense observations: which weekday tends to
 * be yours, how much focus you gave, when your attention peaks. Only appears
 * once there's enough to notice — quiet weeks are left in peace.
 */

import { reflectionNotes } from "@/lib/insights";

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
  const notes = reflectionNotes({
    byDate,
    totalCompleted,
    totalFocusMin,
    peakHour,
  });

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
