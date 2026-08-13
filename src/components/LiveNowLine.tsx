"use client";

/**
 * Live now-line + shared hook for current minutes-from-midnight.
 * Mount-gated to avoid SSR/client time hydration mismatch.
 */

import { useEffect, useRef, useState } from "react";
import { dateToMinutesFromMidnight } from "@/lib/adapters";
import { formatTime } from "@/lib/time-format";
import { useHourCycle } from "@/lib/use-hour-cycle";

const DAY_START = 7 * 60;
const DAY_END = 23 * 60;
const PX_PER_MIN = 1.7;

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
  dayStartMin = DAY_START,
  dayEndMin = DAY_END,
}: {
  nowMin?: number;
  zone?: string;
  /** Canvas bounds — must match the hosting timeline's grid. */
  dayStartMin?: number;
  dayEndMin?: number;
} = {}) {
  const hourCycle = useHourCycle();
  const top = (min: number) => (min - dayStartMin) * PX_PER_MIN;
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

  const ready = mounted && nowMin != null;

  // Bring the current time into view on first load. scrollIntoView walks every
  // scrollable ancestor (the page scrolls at the window level, not a wrapper
  // div), so this works wherever the timeline is embedded. One shot is not
  // enough: the line's offset comes from the timeline's laid-out height, so an
  // early pass can measure it mid-layout, and a late re-render can reset the
  // scroll out from under a smooth one. Watch for a beat instead, and stand
  // down the moment the user takes over.
  useEffect(() => {
    if (!ready || scrolled.current) return;

    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const deadline = Date.now() + 2500;
    let raf = 0;
    let lastY = Number.NaN;
    let retryAfter = 0;
    let moved = false;

    const finish = () => {
      scrolled.current = true;
      cancelAnimationFrame(raf);
      for (const evt of ["wheel", "touchmove", "keydown", "pointerdown"]) {
        window.removeEventListener(evt, finish);
      }
    };

    const tick = () => {
      const el = lineRef.current;
      const vh = window.innerHeight || 0;
      const y = window.scrollY;
      const idle = y === lastY;
      lastY = y;
      if (Date.now() > deadline) return finish();
      // Never measure mid-scroll: a smooth scroll in flight reads as out of view.
      if (el && vh > 0 && idle && Date.now() >= retryAfter) {
        const rect = el.getBoundingClientRect();
        // Comfortably in view — don't yank the page.
        if (rect.top < vh * 0.1 || rect.top > vh * 0.7) {
          const smooth = !reduceMotion && !moved;
          el.scrollIntoView({ block: "center", behavior: smooth ? "smooth" : "auto" });
          moved = true;
          retryAfter = Date.now() + (smooth ? 700 : 250);
        }
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    for (const evt of ["wheel", "touchmove", "keydown", "pointerdown"]) {
      window.addEventListener(evt, finish, { passive: true });
    }
    return () => {
      cancelAnimationFrame(raf);
      for (const evt of ["wheel", "touchmove", "keydown", "pointerdown"]) {
        window.removeEventListener(evt, finish);
      }
    };
  }, [ready]);

  if (!mounted || nowMin == null) return null;

  const clampedMin = Math.max(dayStartMin, Math.min(dayEndMin, nowMin));

  return (
    <div>
      <div
        ref={lineRef}
        className="pointer-events-none absolute inset-x-0 z-20 flex items-center gap-2"
        style={{ top: top(clampedMin) }}
      >
        <span className="tnum min-w-10 shrink-0 -translate-y-1/2 whitespace-nowrap rounded-md bg-now px-1 text-center text-[11px] font-bold text-now-ink">
          {formatTime(Math.floor(clampedMin), hourCycle)}
        </span>
        <div className="relative h-0.5 flex-1 rounded bg-now">
          <span className="absolute -left-1 top-1/2 size-2.5 -translate-y-1/2 rounded-full bg-now" />
        </div>
      </div>
    </div>
  );
}
