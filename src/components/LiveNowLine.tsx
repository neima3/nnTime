"use client";

/**
 * Live now-line + shared hook for current minutes-from-midnight.
 * Mount-gated to avoid SSR/client time hydration mismatch.
 */

import { useEffect, useRef, useState } from "react";
import { dateToMinutesFromMidnight } from "@/lib/adapters";
import { fmt } from "@/lib/mock";

const DAY_START = 7 * 60;
const DAY_END = 23 * 60;
const PX_PER_MIN = 1.7;

const top = (min: number) => (min - DAY_START) * PX_PER_MIN;

/** Browser-local minutes from midnight (includes fractional seconds for smooth line). */
function nowMinutesLocal() {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
}

function nowMinutes(zone?: string) {
  if (zone) return dateToMinutesFromMidnight(new Date(), zone);
  return nowMinutesLocal();
}

/** Live minutes from midnight; null until client mount when `live` is true. */
export function useLiveNowMin(live: boolean, zone?: string): number | null {
  const [nowMin, setNowMin] = useState<number | null>(live ? null : 0);

  useEffect(() => {
    if (!live) return;
    /* eslint-disable react-hooks/set-state-in-effect */
    setNowMin(nowMinutes(zone));
    /* eslint-enable react-hooks/set-state-in-effect */
    const interval = setInterval(() => setNowMin(nowMinutes(zone)), 1000);
    return () => clearInterval(interval);
  }, [live, zone]);

  return live ? nowMin : null;
}

export function LiveNowLine({
  nowMin: external,
  zone,
}: { nowMin?: number; zone?: string } = {}) {
  const internal = useLiveNowMin(external === undefined, zone);
  const nowMin = external ?? internal;
  const [mounted, setMounted] = useState(false);
  const lineRef = useRef<HTMLDivElement>(null);
  const scrolled = useRef(false);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setMounted(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  // Bring the current time into view on first load. scrollIntoView walks every
  // scrollable ancestor (the page scrolls at the window level, not a wrapper
  // div), so this works wherever the timeline is embedded.
  useEffect(() => {
    if (!mounted || nowMin == null || scrolled.current) return;
    const el = lineRef.current;
    if (!el) return;
    scrolled.current = true;
    const rect = el.getBoundingClientRect();
    const vh = window.innerHeight || 0;
    // Already comfortably in view — don't yank the page.
    if (rect.top >= vh * 0.1 && rect.top <= vh * 0.7) return;
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ block: "center", behavior: reduceMotion ? "auto" : "smooth" });
  }, [mounted, nowMin]);

  if (!mounted || nowMin == null) return null;

  const clampedMin = Math.max(DAY_START, Math.min(DAY_END, nowMin));

  return (
    <div>
      <div
        ref={lineRef}
        className="absolute inset-x-0 z-20 flex items-center gap-2"
        style={{ top: top(clampedMin) }}
      >
        <span className="tnum w-10 -translate-y-1/2 rounded-md bg-now text-center text-[11px] font-bold text-now-ink">
          {fmt(Math.floor(clampedMin))}
        </span>
        <div className="relative h-0.5 flex-1 rounded bg-now">
          <span className="absolute -left-1 top-1/2 size-2.5 -translate-y-1/2 rounded-full bg-now" />
        </div>
      </div>
    </div>
  );
}
