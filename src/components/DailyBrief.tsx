"use client";

/**
 * Smart Daily Brief (T9) — a warm morning orientation.
 *
 * One glance that answers "what is today?" without making you read the whole
 * timeline: how many blocks, what's first, and — if we've learned it — when
 * your focus tends to peak so you can aim the hard thing at it. Shows only in
 * the morning, only today, dismissible for the day. Reuses the day's blocks +
 * the focus-hours stat; no new API.
 */

import { useEffect, useState } from "react";
import { Sun, X } from "lucide-react";
import { clientToday } from "@/lib/client-date";
import { fmt } from "@/lib/mock";
import { hourLabel, focusSessionCount, PEAK_MIN_SESSIONS } from "@/lib/insights";

export type BriefBlock = {
  title: string;
  emoji: string;
  start: number;
  done: boolean;
};

export function DailyBrief({ blocks }: { blocks: BriefBlock[] }) {
  const [dismissed, setDismissed] = useState(true);
  const [peakHour, setPeakHour] = useState<number | null>(null);

  useEffect(() => {
    const today = clientToday();
    // Morning-only, and only once per day.
    const hour = new Date().getHours();
    if (hour >= 12) return;
    if (localStorage.getItem("kairo:brief-dismissed") === today) return;
    /* eslint-disable react-hooks/set-state-in-effect */
    setDismissed(false);
    /* eslint-enable react-hooks/set-state-in-effect */

    fetch("/api/v1/stats?days=30")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data?.focusHours) return;
        if (focusSessionCount(data.focusHours.hours) < PEAK_MIN_SESSIONS) return;
        setPeakHour(data.focusHours.peakHour);
      })
      .catch(() => {});
  }, []);

  if (dismissed) return null;

  const total = blocks.length;
  const done = blocks.filter((b) => b.done).length;
  const remaining = blocks
    .filter((b) => !b.done)
    .sort((a, b) => a.start - b.start);
  const first = remaining[0];

  const hour = new Date().getHours();
  const greeting = hour < 5 ? "Still up" : hour < 12 ? "Good morning" : "Hello";

  function dismiss() {
    setDismissed(true);
    try {
      localStorage.setItem("kairo:brief-dismissed", clientToday());
    } catch {}
  }

  return (
    <div className="mb-5 rounded-2xl border border-border bg-gradient-to-br from-cat-butter/40 to-surface px-4 py-3.5 shadow-card">
      <div className="flex items-start gap-3">
        <span
          className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl bg-cat-butter text-cat-butter-ink"
          aria-hidden
        >
          <Sun size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-bold text-ink">
            {greeting}. {total === 0
              ? "Nothing scheduled yet — a blank, gentle day."
              : `${total} thing${total === 1 ? "" : "s"} on today${
                  done > 0 ? `, ${done} already done` : ""
                }.`}
          </p>
          {first && (
            <p className="mt-0.5 text-[13px] font-medium text-ink-soft">
              First up · {first.emoji} {first.title} at {fmt(first.start)}
            </p>
          )}
          {peakHour != null && (
            <p className="mt-1.5 text-[12.5px] font-medium text-ink-soft">
              💡 Your focus usually peaks around {hourLabel(peakHour)} — a good
              slot for the hard one.
            </p>
          )}
        </div>
        <button
          type="button"
          aria-label="Dismiss for today"
          onClick={dismiss}
          className="-mr-1 shrink-0 rounded-lg p-1 text-ink-faint hover:text-ink focus-visible:ring-2 focus-visible:ring-iris focus-visible:outline-none"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
