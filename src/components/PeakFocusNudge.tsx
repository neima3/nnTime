"use client";

/**
 * Peak-Focus Nudge (P15 — uses the focus-hours data).
 *
 * The Insights page already learns when your attention lands most often. This
 * quietly surfaces that on Today: when the current hour is inside (or just
 * before) your personal peak window, it offers to protect it with a focus
 * block. Dismissible, once per day, and it stays silent until there's enough
 * history to mean something.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles, X } from "lucide-react";
import { clientToday } from "@/lib/client-date";

function hourLabel(h: number) {
  if (h === 0) return "midnight";
  if (h === 12) return "noon";
  const period = h < 12 ? "am" : "pm";
  const twelve = h % 12 === 0 ? 12 : h % 12;
  return `${twelve}${period}`;
}

export function PeakFocusNudge() {
  const [peakHour, setPeakHour] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    const today = clientToday();
    if (typeof window !== "undefined" &&
        localStorage.getItem("kairo:peak-nudge-dismissed") === today) {
      return;
    }
    let cancelled = false;
    fetch("/api/v1/stats?days=30")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data?.focusHours) return;
        const hours: number[] = data.focusHours.hours ?? [];
        const sessions = hours.reduce((a, b) => a + b, 0);
        // Need a real pattern before we claim one.
        if (sessions < 4) return;
        setPeakHour(data.focusHours.peakHour);
        setDismissed(false);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (dismissed || peakHour == null) return null;

  const nowHour = new Date().getHours();
  // Show inside the window: the hour before, the peak hour, and the hour after.
  const inWindow = Math.abs(nowHour - peakHour) <= 1;
  if (!inWindow) return null;

  function dismiss() {
    setDismissed(true);
    try {
      localStorage.setItem("kairo:peak-nudge-dismissed", clientToday());
    } catch {}
  }

  const isNow = nowHour === peakHour;

  return (
    <div className="mb-5 flex items-center gap-3 rounded-2xl border border-iris/30 bg-iris-ghost px-4 py-3.5">
      <span
        className="grid size-9 shrink-0 place-items-center rounded-xl bg-iris-soft text-iris"
        aria-hidden
      >
        <Sparkles size={17} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-bold text-ink">
          {isNow
            ? "This is usually your sharpest hour"
            : `Your focus peaks around ${hourLabel(peakHour)}`}
        </p>
        <p className="text-[12.5px] font-medium text-ink-soft">
          Want to protect it with one focus block before it slips?
        </p>
      </div>
      <Link
        href="/app/focus"
        className="shrink-0 rounded-xl bg-iris px-3.5 py-2 text-[13px] font-semibold text-ink-inverse shadow-card transition-colors hover:bg-iris-deep focus-visible:ring-2 focus-visible:ring-iris focus-visible:outline-none"
      >
        Focus
      </Link>
      <button
        type="button"
        aria-label="Dismiss for today"
        onClick={dismiss}
        className="-mr-1 shrink-0 rounded-lg p-1 text-ink-faint hover:text-ink focus-visible:ring-2 focus-visible:ring-iris focus-visible:outline-none"
      >
        <X size={16} />
      </button>
    </div>
  );
}
