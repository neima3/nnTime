"use client";

/**
 * One Thing mode (10× ADHD Phase 8 — overwhelm reduction).
 *
 * A full-screen card showing ONLY what matters right now: the current
 * activity, how much of it is left, and its next small step. Everything else
 * disappears. Open with `o` from anywhere in the app or the ⛶ button on the
 * Now card; Esc or ✕ closes. Focus's calmer sibling — no timer mechanics.
 */
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Timer, X } from "lucide-react";
import { useNowInfo } from "./NowBar";
import { fmt } from "@/lib/mock";

const EVENT = "kairo:one-thing";

export function openOneThing() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(EVENT));
}

export function OneThing() {
  const [open, setOpen] = useState(false);
  const info = useNowInfo();
  const primaryRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (open) primaryRef.current?.focus();
  }, [open]);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener(EVENT, onOpen);
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable ||
        target.tagName === "SELECT"
      )
        return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key.toLowerCase() === "o") {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener(EVENT, onOpen);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  if (!open) return null;

  const current = info?.current ?? null;
  const next = info?.next ?? null;
  const subject = current ?? next;

  return (
    <div className="fixed inset-0 z-[70] flex flex-col items-center justify-center bg-canvas px-6">
      <button
        type="button"
        aria-label="Close one-thing view"
        onClick={() => setOpen(false)}
        className="absolute right-5 top-5 grid size-11 place-items-center rounded-2xl border border-border bg-surface text-ink-soft shadow-card hover:text-ink focus-visible:ring-2 focus-visible:ring-iris focus-visible:outline-none"
      >
        <X size={18} />
      </button>

      {subject ? (
        <div className="rise-in flex max-w-lg flex-col items-center text-center">
          <p
            className={`text-[12px] font-bold uppercase tracking-[0.16em] ${
              current ? "text-now" : "text-ink-faint"
            }`}
          >
            {current ? "This is the only thing" : `Next · at ${fmt(subject.startMin)}`}
          </p>
          <span className="mt-8 text-7xl" aria-hidden>
            {subject.emoji}
          </span>
          <h1 className="mt-6 font-display text-4xl font-bold leading-tight tracking-tight md:text-5xl">
            {subject.title}
          </h1>
          {current && info && (
            <p className="tnum mt-4 text-lg font-semibold text-ink-soft">
              {Math.max(1, current.endMin - info.nowMin)} min left — no rush
            </p>
          )}
          {subject.nextSteps.length > 0 && (
            <div className="mt-8 rounded-2xl border border-border bg-surface px-5 py-3.5 shadow-card">
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink-faint">
                Just the next step
              </p>
              <p className="mt-1 text-[15px] font-semibold">
                {subject.nextSteps[0]}
              </p>
            </div>
          )}
          <div className="mt-10 flex items-center gap-3">
            <Link
              ref={primaryRef}
              href={`/app/focus?${new URLSearchParams({
                title: subject.title,
                emoji: subject.emoji,
                duration: String(
                  Math.min(60, Math.max(5, subject.endMin - subject.startMin)),
                ),
              })}`}
              className="inline-flex items-center gap-2 rounded-2xl bg-iris px-6 py-3 text-[15px] font-semibold text-ink-inverse shadow-card transition-all hover:bg-iris-deep focus-visible:ring-2 focus-visible:ring-iris focus-visible:outline-none active:scale-[0.98]"
              onClick={() => setOpen(false)}
            >
              <Timer size={17} />
              Focus on it
            </Link>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-2xl px-4 py-3 text-[14px] font-semibold text-ink-soft hover:bg-surface-sunken focus-visible:ring-2 focus-visible:ring-iris focus-visible:outline-none"
            >
              Back to everything
            </button>
          </div>
        </div>
      ) : (
        <div className="rise-in flex max-w-md flex-col items-center text-center">
          <span className="text-6xl" aria-hidden>
            🌤
          </span>
          <h1 className="mt-6 font-display text-3xl font-bold tracking-tight">
            Nothing scheduled right now.
          </h1>
          <p className="mt-2 text-[15px] text-ink-soft">
            The space is yours. Rest counts too.
          </p>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="mt-8 rounded-2xl border border-border bg-surface px-6 py-3 text-[14px] font-semibold text-ink-soft shadow-card hover:text-ink"
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}
