"use client";

/**
 * Shared chrome for brain-break games: header with title + how-to + best
 * chip, exit button, and a consistent end-state layout. Games stay ≤2 min
 * with a natural stop — the end state always offers "Back to my day".
 */
import { useEffect, useId, useRef } from "react";
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
  const dialogRef = useRef<HTMLDialogElement>(null);
  const exitRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    exitRef.current?.focus();
    return () => {
      if (dialog.open) dialog.close();
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onExit();
      }}
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const focusable = Array.from(
          event.currentTarget.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
          ),
        ).filter((element) => element.getClientRects().length > 0);
        if (focusable.length === 0) {
          event.preventDefault();
          event.currentTarget.focus();
          return;
        }
        const first = focusable[0]!;
        const last = focusable.at(-1)!;
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }}
      className="m-0 h-dvh max-h-none w-screen max-w-none border-0 bg-canvas p-0 text-ink backdrop:bg-canvas/70 open:flex open:flex-col"
    >
      <header className="mx-auto flex w-full max-w-2xl items-start gap-3 px-5 pt-5">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-iris-ghost text-xl" aria-hidden>
          {emoji}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h1 id={titleId} className="font-display text-lg font-bold leading-tight">
              {title}
            </h1>
            {best && (
              <span className="tnum shrink-0 rounded-xl bg-surface-sunken px-2.5 py-1.5 text-[12px] font-bold text-ink-soft">
                best {best}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-pretty text-[12.5px] font-medium leading-snug text-ink-soft">
            {howTo}
          </p>
        </div>
        <button
          ref={exitRef}
          type="button"
          aria-label="Exit game"
          onClick={onExit}
          className="grid size-11 shrink-0 place-items-center rounded-2xl border border-border bg-surface text-ink-soft shadow-card hover:text-ink focus-visible:ring-2 focus-visible:ring-iris focus-visible:outline-none"
        >
          <X size={17} />
        </button>
      </header>
      {/* my-auto (not justify-center) so tall content scrolls from its top
          instead of clipping both ends off-screen. */}
      <div className="flex min-h-0 flex-1 flex-col items-center overflow-y-auto px-5 pb-10">
        <div className="my-auto flex w-full flex-col items-center pt-4">
          {children}
        </div>
      </div>
    </dialog>
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
