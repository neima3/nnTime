"use client";

/**
 * Global shortcuts: `n` → new activity, `?` → help overlay.
 * Ignores keypresses while typing in inputs.
 */
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { X } from "lucide-react";
import { clientToday } from "@/lib/client-date";

function isTypingTarget(el: EventTarget | null) {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    el.isContentEditable
  );
}

export function KeyboardShortcuts() {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === "?" || (e.shiftKey && e.key === "/")) {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }
      if (e.key === "Escape") {
        setOpen(false);
        return;
      }
      if (e.key === "n" || e.key === "N") {
        // Only in app shell routes
        if (!pathname?.startsWith("/app")) return;
        e.preventDefault();
        const date = clientToday();
        router.push(`/app/editor?date=${date}&start=${9 * 60}`);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router, pathname]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="kbd-help-title"
      className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-sm rounded-3xl border border-border bg-surface p-6 shadow-float"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <h2 id="kbd-help-title" className="font-display text-xl font-bold">
            Keyboard
          </h2>
          <button
            type="button"
            aria-label="Close"
            onClick={() => setOpen(false)}
            className="grid size-8 place-items-center rounded-xl text-ink-soft hover:bg-surface-sunken"
          >
            <X size={16} />
          </button>
        </div>
        <ul className="mt-4 space-y-2 text-[14px]">
          <li className="flex justify-between gap-4">
            <span className="text-ink-soft">New activity</span>
            <kbd className="rounded-lg bg-surface-sunken px-2 py-0.5 font-mono text-[12px] font-bold">
              n
            </kbd>
          </li>
          <li className="flex justify-between gap-4">
            <span className="text-ink-soft">Quick capture a thought</span>
            <kbd className="rounded-lg bg-surface-sunken px-2 py-0.5 font-mono text-[12px] font-bold">
              c
            </kbd>
          </li>
          <li className="flex justify-between gap-4">
            <span className="text-ink-soft">One-thing view</span>
            <kbd className="rounded-lg bg-surface-sunken px-2 py-0.5 font-mono text-[12px] font-bold">
              o
            </kbd>
          </li>
          <li className="flex justify-between gap-4">
            <span className="text-ink-soft">This help</span>
            <kbd className="rounded-lg bg-surface-sunken px-2 py-0.5 font-mono text-[12px] font-bold">
              ?
            </kbd>
          </li>
          <li className="flex justify-between gap-4">
            <span className="text-ink-soft">Close / cancel</span>
            <kbd className="rounded-lg bg-surface-sunken px-2 py-0.5 font-mono text-[12px] font-bold">
              Esc
            </kbd>
          </li>
          <li className="flex justify-between gap-4">
            <span className="text-ink-soft">Move selected block</span>
            <kbd className="rounded-lg bg-surface-sunken px-2 py-0.5 font-mono text-[12px] font-bold">
              ↑ ↓
            </kbd>
          </li>
        </ul>
      </div>
    </div>
  );
}
