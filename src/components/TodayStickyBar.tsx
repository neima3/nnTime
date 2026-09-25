"use client";

/**
 * Slim day bar that slides in once the Today header scrolls away.
 *
 * Today auto-scrolls to the now-line, which takes the date, the progress ring
 * and the day switcher off screen — on a phone you land on a timeline with no
 * idea which day it is. This keeps the answer (and a way back to "now") pinned
 * to the top without adding height to the page: the wrapper is zero-height and
 * the bar floats inside it.
 */
import Link from "next/link";
import { ChevronLeft, ChevronRight, LocateFixed } from "lucide-react";
import { useEffect, useState } from "react";

export function TodayStickyBar({
  watchId,
  dayLabel,
  dayDate,
  done,
  total,
  prevDate,
  nextDate,
  isToday,
}: {
  /** id of the header element; the bar shows while it is off screen. */
  watchId: string;
  dayLabel: string;
  dayDate: string;
  done: number;
  total: number;
  prevDate?: string;
  nextDate?: string;
  isToday: boolean;
}) {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = document.getElementById(watchId);
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([entry]) => setShown(!entry.isIntersecting),
      { threshold: 0 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [watchId]);

  const jumpToNow = () => {
    const line = document.querySelector<HTMLElement>("[data-now-line]");
    const reduce =
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    line?.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
  };

  const toTop = () => {
    const reduce =
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  };

  const pct = total ? Math.round((done / total) * 100) : 0;
  const nav =
    "grid size-8 place-items-center rounded-lg text-ink-soft transition-colors hover:bg-surface-sunken hover:text-ink focus-visible:ring-2 focus-visible:ring-iris focus-visible:outline-none";

  return (
    <div className="pointer-events-none sticky top-0 z-30 h-0">
      <div
        inert={!shown}
        aria-hidden={!shown}
        className={`pointer-events-auto -mx-4 flex items-center gap-2 border-b border-border bg-surface/90 px-4 py-2 backdrop-blur-md transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none md:mx-0 md:mt-3 md:rounded-2xl md:border md:px-3 md:shadow-card ${
          shown ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0"
        }`}
      >
        <button
          type="button"
          onClick={toTop}
          className="min-w-0 flex-1 truncate rounded-lg px-1 text-left focus-visible:ring-2 focus-visible:ring-iris focus-visible:outline-none"
          aria-label={`${dayLabel}, ${dayDate}. Back to the top of the day.`}
        >
          {/* Abbreviated so it never reads as a second copy of the header. */}
          <span className="hidden text-[11px] font-bold uppercase tracking-[0.12em] text-iris sm:inline">
            {dayLabel.slice(0, 3)}{" "}
          </span>
          <span className="font-display text-[15px] font-bold text-ink">
            {dayDate}
          </span>
        </button>

        {total > 0 && (
          <span
            className="tnum flex shrink-0 items-center gap-1.5 rounded-full bg-surface-sunken px-2 py-1 text-[11.5px] font-bold text-ink-soft"
            aria-label={`${done} of ${total} done`}
          >
            <span className="relative hidden h-1.5 w-8 overflow-hidden rounded-full bg-border sm:block" aria-hidden>
              <span
                className={`absolute inset-y-0 left-0 rounded-full ${pct === 100 ? "bg-success" : "bg-iris"}`}
                style={{ width: `${pct}%` }}
              />
            </span>
            {done}/{total}
          </span>
        )}

        {isToday && (
          <button
            type="button"
            onClick={jumpToNow}
            className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1.5 text-[12.5px] font-semibold text-now-text transition-colors hover:bg-surface-sunken focus-visible:ring-2 focus-visible:ring-iris focus-visible:outline-none"
          >
            <LocateFixed size={14} aria-hidden />
            Now
          </button>
        )}

        <div className="flex shrink-0 items-center">
          {prevDate && (
            <Link href={`/app/today?date=${prevDate}`} aria-label="Previous day" className={nav}>
              <ChevronLeft size={17} />
            </Link>
          )}
          {!isToday && (
            <Link
              href="/app/today"
              className="rounded-lg px-2 py-1.5 text-[12.5px] font-semibold text-iris hover:bg-iris-ghost focus-visible:ring-2 focus-visible:ring-iris focus-visible:outline-none"
            >
              Today
            </Link>
          )}
          {nextDate && (
            <Link href={`/app/today?date=${nextDate}`} aria-label="Next day" className={nav}>
              <ChevronRight size={17} />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
