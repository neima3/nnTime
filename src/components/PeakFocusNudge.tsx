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
import { CalendarPlus, Check, Sparkles, X } from "lucide-react";
import { clientToday } from "@/lib/client-date";
import { detectTimezone } from "@/lib/timezone";
import { localMinutesToInstant } from "@/lib/adapters";
import { toast } from "./Toast";
import {
  hourLabel,
  focusSessionCount,
  isInPeakWindow,
  PEAK_MIN_SESSIONS,
} from "@/lib/insights";

export function PeakFocusNudge() {
  const [peakHour, setPeakHour] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState(true);
  const [protecting, setProtecting] = useState(false);
  const [protectedDaily, setProtectedDaily] = useState(false);

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
        // Need a real pattern before we claim one.
        if (focusSessionCount(data.focusHours.hours) < PEAK_MIN_SESSIONS) return;
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
  if (!isInPeakWindow(nowHour, peakHour)) return null;

  function dismiss() {
    setDismissed(true);
    try {
      localStorage.setItem("kairo:peak-nudge-dismissed", clientToday());
    } catch {}
  }

  // R9 — carve out the peak hour as a recurring daily focus anchor.
  async function protectPeak() {
    if (peakHour == null) return;
    setProtecting(true);
    try {
      const zone = detectTimezone();
      const res = await fetch("/api/v1/activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tz: zone,
          dtstartLocal: localMinutesToInstant(clientToday(), peakHour * 60, zone),
          title: "Focus time",
          emoji: "🎯",
          durationMin: 45,
          rrule: "FREQ=DAILY",
          source: "manual",
        }),
      });
      if (!res.ok) {
        toast("Couldn't block it — try again");
        setProtecting(false);
        return;
      }
      setProtectedDaily(true);
      toast(`Your ${hourLabel(peakHour)} focus hour is protected, daily`);
    } catch {
      toast("Couldn't reach the server. Please try again.");
    }
    setProtecting(false);
  }

  const isNow = nowHour === peakHour;

  return (
    <div className="mb-5 rounded-2xl border border-iris/30 bg-iris-ghost px-4 py-3.5">
      <div className="flex items-center gap-3">
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
          Focus now
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
      <div className="mt-2.5 flex justify-end">
        <button
          type="button"
          disabled={protecting || protectedDaily}
          onClick={protectPeak}
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[12px] font-semibold text-iris-deep transition-colors hover:bg-iris-soft focus-visible:ring-2 focus-visible:ring-iris focus-visible:outline-none disabled:opacity-70"
        >
          {protectedDaily ? (
            <>
              <Check size={13} /> Blocked daily at {hourLabel(peakHour)}
            </>
          ) : (
            <>
              <CalendarPlus size={13} />
              {protecting ? "Protecting…" : `Protect ${hourLabel(peakHour)} every day`}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
