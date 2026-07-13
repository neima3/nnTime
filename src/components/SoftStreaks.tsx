"use client";

/**
 * Soft streaks — Phase 3C.
 *
 * Qualifying action = any planned item completed that day in the user's
 * planning zone. 1-day grace (you can miss one day without breaking the
 * streak). Opt-out. No shame copy — gentle framing only.
 *
 * Reads from the /api/v1/changes feed to count completion events per day.
 * Mount-gated (no SSR streak display to avoid mismatch).
 */

import { useEffect, useState } from "react";
import { Flame } from "lucide-react";

interface SoftStreaksProps {
  /** Opt-out flag from user settings. */
  optOut?: boolean;
}

interface StreakData {
  current: number;
  best: number;
}

export function SoftStreaks({ optOut }: SoftStreaksProps) {
  const [mounted, setMounted] = useState(false);
  const [streak, setStreak] = useState<StreakData>({ current: 0, best: 0 });

  useEffect(() => {
    // Mount-gated: fetch streak data from the changes feed.
    /* eslint-disable react-hooks/set-state-in-effect */
    setMounted(true);
    // Fetch completion events from the changes feed.
    fetch("/api/v1/changes?limit=500")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data?.items) return;
        // Extract completion events and bucket by date.
        const completions = new Set<string>();
        for (const item of data.items) {
          if (item.entityType === "planner_events" || item.op === "upsert") {
            const date = new Date(item.occurredAt).toISOString().slice(0, 10);
            completions.add(date);
          }
        }
        // Compute streak with 1-day grace.
        const dates = [...completions].sort();
        let best = 0;
        let currentRun = 0;
        for (let i = 0; i < dates.length; i++) {
          if (i === 0) {
            currentRun = 1;
          } else {
            const prev = new Date(dates[i - 1]);
            const curr = new Date(dates[i]);
            const diff = Math.round((curr.getTime() - prev.getTime()) / 86400000);
            if (diff === 1) currentRun++;
            else if (diff === 2) currentRun++; // 1-day grace
            else currentRun = 1;
          }
          best = Math.max(best, currentRun);
        }
        // Check if the streak is still "current" (today or yesterday).
        const today = new Date().toISOString().slice(0, 10);
        const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
        const lastDate = dates[dates.length - 1];
        const current = lastDate === today || lastDate === yesterday ? currentRun : 0;
        setStreak({ current, best });
      })
      .catch(() => {
        // No data yet — streak stays at 0.
      });
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  if (optOut) return null;
  if (!mounted) return null;
  if (streak.current === 0 && streak.best === 0) return null;

  return (
    <div className="flex items-center gap-2 rounded-2xl border border-border bg-surface px-3 py-2 shadow-card">
      <Flame
        size={18}
        className={streak.current > 0 ? "text-iris" : "text-ink-faint"}
      />
      <div>
        <p className="tnum text-sm font-bold leading-none">
          {streak.current > 0 ? `${streak.current} day${streak.current === 1 ? "" : "s"}` : "—"}
        </p>
        <p className="mt-0.5 text-[11px] font-medium text-ink-soft">
          {streak.current > 0
            ? streak.current === 1
              ? "A gentle start"
              : streak.current < 5
                ? "Building gently"
                : streak.current < 10
                  ? "Lovely rhythm"
                  : "Beautiful consistency"
            : `Best: ${streak.best} days`}
        </p>
      </div>
    </div>
  );
}
