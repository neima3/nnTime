"use client";

import { useEffect, useState } from "react";

type ToastPayload = {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  durationMs?: number;
};

let pushToast: ((t: ToastPayload) => void) | null = null;

export function toast(
  message: string,
  opts?: { actionLabel: string; onAction: () => void; durationMs?: number },
) {
  pushToast?.({ message, ...opts });
}

export function ToastHost() {
  const [current, setCurrent] = useState<ToastPayload | null>(null);

  useEffect(() => {
    let timer: number;
    pushToast = (t: ToastPayload) => {
      window.clearTimeout(timer);
      setCurrent(t);
      timer = window.setTimeout(
        () => setCurrent(null),
        t.durationMs ?? (t.actionLabel ? 5000 : 2400),
      );
    };
    return () => {
      window.clearTimeout(timer);
      pushToast = null;
    };
  }, []);

  if (!current) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-28 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-2xl bg-ink px-4 py-2.5 text-[13px] font-semibold text-ink-inverse shadow-float md:bottom-10"
    >
      {current.message}
      {current.actionLabel && current.onAction && (
        <button
          type="button"
          onClick={() => {
            current.onAction?.();
            setCurrent(null);
          }}
          className="-my-1 rounded-lg bg-surface-raised/20 px-2.5 py-1 font-bold text-ink-inverse transition-colors hover:bg-surface-raised/30 focus-visible:ring-2 focus-visible:ring-iris focus-visible:outline-none"
        >
          {current.actionLabel}
        </button>
      )}
    </div>
  );
}
