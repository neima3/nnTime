"use client";

/**
 * Live now-line — Phase 3C.
 *
 * Renders a coral now-line at the current time position on the timeline,
 * updating every second. Mount-gated: renders nothing on SSR, then appears
 * on the client after mount to avoid hydration mismatch (the server doesn't
 * know the real time at render).
 *
 * Auto-scroll: scrolls the timeline container so the now-line is visible
 * on mount (brings the user to "now" instead of the top of the day).
 */

import { useEffect, useRef, useState } from "react";
import { fmt } from "@/lib/mock";

const DAY_START = 7 * 60;
const DAY_END = 23 * 60;
const PX_PER_MIN = 1.7;

const top = (min: number) => (min - DAY_START) * PX_PER_MIN;

function nowMinutes() {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
}

export function LiveNowLine() {
  const [mounted, setMounted] = useState(false);
  const [nowMin, setNowMin] = useState(13 * 60); // default 13:00 (matches mock)
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Mount-gated: set real time only on client to avoid hydration mismatch.
    // The setState calls here are intentional — the whole point is to update
    // from the SSR-default (13:00) to the real client time after mount.
    /* eslint-disable react-hooks/set-state-in-effect */
    setMounted(true);
    setNowMin(nowMinutes());
    /* eslint-enable react-hooks/set-state-in-effect */

    const interval = setInterval(() => {
      setNowMin(nowMinutes());
    }, 1000); // update once per second per design-spec

    return () => clearInterval(interval);
  }, []);

  // Auto-scroll to now on mount.
  useEffect(() => {
    if (!mounted) return;
    const el = containerRef.current?.closest(".timeline-scroll-container");
    if (el) {
      const nowTop = top(nowMin);
      el.scrollTo({ top: Math.max(0, nowTop - el.clientHeight / 2), behavior: "smooth" });
    }
  }, [mounted, nowMin]);

  if (!mounted) return null; // no SSR — prevents hydration mismatch

  const clampedMin = Math.max(DAY_START, Math.min(DAY_END, nowMin));

  return (
    <div ref={containerRef}>
      <div
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
