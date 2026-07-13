"use client";

/**
 * Current-activity ring + overtime prompt — Phase 3C.
 *
 * Shows a small ring around the current activity's emoji that fills as time
 * elapses. When the activity goes past its end time (overtime), shows a gentle
 * "running over" prompt. Mount-gated to avoid hydration mismatch.
 */

import { useEffect, useState } from "react";

interface CurrentActivityRingProps {
  activityStart: number; // minutes from midnight
  activityDuration: number; // minutes
  emoji: string;
  /** The now-line position (minutes from midnight). Updated externally. */
  nowMin?: number;
}

export function CurrentActivityRing({
  activityStart,
  activityDuration,
  emoji,
  nowMin: externalNow,
}: CurrentActivityRingProps) {
  const [mounted, setMounted] = useState(false);
  const [nowMin, setNowMin] = useState(externalNow ?? 13 * 60);

  useEffect(() => {
    // Mount-gated: intentional setState to sync real client time.
    /* eslint-disable react-hooks/set-state-in-effect */
    setMounted(true);
    if (externalNow === undefined) {
      const now = new Date();
      setNowMin(now.getHours() * 60 + now.getMinutes());
      const interval = setInterval(() => {
        const n = new Date();
        setNowMin(n.getHours() * 60 + n.getMinutes());
      }, 30000); // 30s is enough for the ring
      return () => clearInterval(interval);
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [externalNow]);

  if (!mounted) return <span aria-hidden>{emoji}</span>;

  const elapsed = nowMin - activityStart;
  const progress = Math.min(1, Math.max(0, elapsed / activityDuration));
  const isOvertime = nowMin > activityStart + activityDuration;
  const r = 14;
  const c = 2 * Math.PI * r;

  return (
    <span className="relative grid place-items-center" aria-hidden>
      <svg width="32" height="32" viewBox="0 0 32 32" className="absolute inset-0 -rotate-90">
        <circle cx="16" cy="16" r={r} fill="none" stroke="var(--border)" strokeWidth="3" opacity="0.3" />
        <circle
          cx="16"
          cy="16"
          r={r}
          fill="none"
          stroke={isOvertime ? "var(--now)" : "var(--iris)"}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - progress)}
        />
      </svg>
      <span className="text-base">{emoji}</span>
      {isOvertime && (
        <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-now-soft px-1.5 py-0.5 text-[10px] font-bold text-now">
          +{Math.floor(nowMin - activityStart - activityDuration)}m
        </span>
      )}
    </span>
  );
}
