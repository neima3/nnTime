"use client";

/**
 * Shared chrome for brain-break games: header with title + how-to + best
 * chip, exit button, and a consistent end-state layout. Games stay ≤2 min
 * with a natural stop — the end state always offers "Back to my day".
 */
import { X } from "lucide-react";

export function GameShell({
  title,
  emoji,
  howTo,
  best,
  onExit,
  children,
}: {
  title: string;
  emoji: string;
  howTo: string;
  best: string | null;
  onExit: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-canvas">
      <header className="mx-auto flex w-full max-w-2xl items-center gap-3 px-5 pt-5">
        <span className="grid size-11 place-items-center rounded-2xl bg-iris-ghost text-xl" aria-hidden>
          {emoji}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-lg font-bold leading-tight">{title}</h1>
          <p className="truncate text-[12.5px] font-medium text-ink-soft">{howTo}</p>
        </div>
        {best && (
          <span className="tnum shrink-0 rounded-xl bg-surface-sunken px-2.5 py-1.5 text-[12px] font-bold text-ink-soft">
            best {best}
          </span>
        )}
        <button
          type="button"
          aria-label="Exit game"
          onClick={onExit}
          className="grid size-10 shrink-0 place-items-center rounded-2xl border border-border bg-surface text-ink-soft shadow-card hover:text-ink focus-visible:ring-2 focus-visible:ring-iris focus-visible:outline-none"
        >
          <X size={17} />
        </button>
      </header>
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-5 pb-10">
        {children}
      </div>
    </div>
  );
}

export function GameEnd({
  headline,
  detail,
  isNewBest,
  onAgain,
  onExit,
}: {
  headline: string;
  detail: string;
  isNewBest: boolean;
  onAgain: () => void;
  onExit: () => void;
}) {
  return (
    <div className="rise-in flex max-w-sm flex-col items-center text-center">
      {isNewBest && (
        <span className="mb-3 rounded-full bg-cat-butter px-3 py-1 text-[12px] font-bold text-cat-butter-ink">
          ✨ New personal best
        </span>
      )}
      <p className="font-display text-3xl font-bold tracking-tight">{headline}</p>
      <p className="mt-2 text-[14.5px] text-ink-soft">{detail}</p>
      <div className="mt-7 flex gap-2.5">
        <button
          type="button"
          onClick={onAgain}
          className="rounded-2xl border border-border bg-surface px-5 py-2.5 text-[14px] font-semibold text-ink-soft shadow-card transition-colors hover:text-ink focus-visible:ring-2 focus-visible:ring-iris focus-visible:outline-none"
        >
          Once more
        </button>
        <button
          type="button"
          onClick={onExit}
          className="rounded-2xl bg-iris px-5 py-2.5 text-[14px] font-semibold text-ink-inverse shadow-card transition-all hover:bg-iris-deep active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-iris focus-visible:outline-none"
        >
          Back to my day
        </button>
      </div>
    </div>
  );
}
