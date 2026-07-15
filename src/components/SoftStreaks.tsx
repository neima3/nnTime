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
    // Mount-gated: real streak from planner_events via stats service.
    /* eslint-disable react-hooks/set-state-in-effect */
    setMounted(true);
    fetch("/api/v1/stats?days=60")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data?.streak) return;
        setStreak({
          current: data.streak.current ?? 0,
          best: data.streak.best ?? 0,
        });
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
