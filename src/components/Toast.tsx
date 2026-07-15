"use client";

import { useEffect, useState } from "react";

let pushToast: ((msg: string) => void) | null = null;

export function toast(message: string) {
  pushToast?.(message);
}

export function ToastHost() {
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    pushToast = (m: string) => {
      setMsg(m);
      window.setTimeout(() => setMsg(null), 2400);
    };
    return () => {
      pushToast = null;
    };
  }, []);

  if (!msg) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-28 left-1/2 z-50 -translate-x-1/2 rounded-2xl bg-ink px-4 py-2.5 text-[13px] font-semibold text-ink-inverse shadow-float md:bottom-10"
    >
      {msg}
    </div>
  );
}
