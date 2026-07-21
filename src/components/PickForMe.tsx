"use client";

/**
 * "Pick for me" (10× ADHD Phase 5 — decision paralysis breaker).
 *
 * One button that answers "what should I do right now?" with exactly ONE
 * thing, chosen deterministically: the activity happening now → the next one
 * coming up → something that slipped earlier today → the highest-priority
 * loose task (oldest first). Shuffle re-rolls among the runners-up. No AI, no
 * config — it works offline on whatever the page already knows.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Dices, Play, X } from "lucide-react";
import { useLowBattery } from "./LowBattery";
import { clientToday } from "@/lib/client-date";

export interface PickCandidate {
  id: string;
  title: string;
  emoji: string;
  /** "now" | "next" | "slipped" | "task" — used for the framing copy. */
  kind: "now" | "next" | "slipped" | "task";
  /** Focus length to suggest (activity duration or 25 for tasks). */
  durationMin: number;
  /** Priority weight for tasks (2 high, 1 low, 0 none). */
  weight?: number;
  /** Energy cost, when known — low-battery days prefer lighter picks. */
  energy?: "low" | "medium" | "high" | null;
}

const KIND_LABEL: Record<PickCandidate["kind"], string> = {
  now: "It's on your timeline right now",
  next: "It's coming up next",
  slipped: "It slipped earlier — still worth a shot",
  task: "One loose end, off your mind",
};

export function PickForMe({
  candidates,
  className = "",
  date,
}: {
  candidates: PickCandidate[];
  className?: string;
  /** Calendar date for low-battery awareness (defaults to today). */
  date?: string;
}) {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [todayStr] = useState(() => clientToday());
  const lowBattery = useLowBattery(date ?? todayStr);
  const primaryRef = useRef<HTMLAnchorElement>(null);

  // Esc closes; focus lands on the primary action when the card opens.
  useEffect(() => {
    if (!open) return;
    primaryRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const ordered = useMemo(() => {
    const rank: Record<PickCandidate["kind"], number> = {
      now: 0,
      next: 1,
      slipped: 2,
      task: 3,
    };
    const adjusted = candidates.map((c) => {
      let weight = c.weight ?? 0;
      if (lowBattery) {
        if (c.energy === "high") weight -= 3;
        else if (c.energy === "low") weight += 1;
      }
      return { ...c, weight };
    });
    return adjusted.sort(
      (a, b) => rank[a.kind] - rank[b.kind] || (b.weight ?? 0) - (a.weight ?? 0),
    );
  }, [candidates, lowBattery]);

  if (ordered.length === 0) return null;
  const pick = ordered[index % ordered.length];

  const focusHref = `/app/focus?${new URLSearchParams({
    title: pick.title,
    emoji: pick.emoji,
    duration: String(pick.durationMin),
    // Activities carry their id so the session links back for time-truth
    // logging; loose tasks have no activity to link.
    ...(pick.kind !== "task" ? { activityId: pick.id } : {}),
  })}`;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setIndex(0);
          setOpen(true);
        }}
        className={`inline-flex items-center gap-1.5 rounded-2xl border border-border bg-surface px-3 py-2 text-[13px] font-semibold text-ink-soft shadow-card transition-colors hover:bg-surface-sunken hover:text-ink focus-visible:ring-2 focus-visible:ring-iris focus-visible:outline-none ${className}`}
      >
        <Dices size={15} />
        Pick for me
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/25 px-4 backdrop-blur-[2px]"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Your one thing"
            className="rise-in w-full max-w-sm rounded-3xl border border-border bg-surface p-6 text-center shadow-float"
          >
            <div className="flex items-start justify-between">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-iris">
                Just this — nothing else
              </p>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setOpen(false)}
                className="-mr-2 -mt-2 rounded-lg p-1.5 text-ink-faint hover:text-ink"
              >
                <X size={16} />
              </button>
            </div>
            <span
              className="mx-auto mt-4 grid size-16 place-items-center rounded-3xl bg-iris-ghost text-3xl"
              aria-hidden
            >
              {pick.emoji}
            </span>
            <p className="mt-4 font-display text-xl font-bold leading-snug">
              {pick.title}
            </p>
            <p className="mt-1.5 text-[13px] font-medium text-ink-soft">
              {KIND_LABEL[pick.kind]}
            </p>
            <div className="mt-6 grid gap-2">
              <Link
                ref={primaryRef}
                href={focusHref}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-iris py-3 text-[15px] font-semibold text-ink-inverse shadow-card transition-all hover:bg-iris-deep focus-visible:ring-2 focus-visible:ring-iris focus-visible:outline-none active:scale-[0.98]"
              >
                <Play size={16} fill="currentColor" />
                Start {pick.durationMin} min on this
              </Link>
              {ordered.length > 1 && (
                <button
                  type="button"
                  onClick={() => setIndex((i) => i + 1)}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-border bg-surface py-3 text-[14px] font-semibold text-ink-soft transition-colors hover:text-ink focus-visible:ring-2 focus-visible:ring-iris focus-visible:outline-none"
                >
                  <Dices size={15} />
                  Something else
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-2xl py-2.5 text-[13px] font-semibold text-ink-faint hover:bg-surface-sunken"
              >
                Not now
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
