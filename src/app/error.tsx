/**
 * Global error boundary — Kairo branded.
 */
"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[kairo] unhandled error:", error);
  }, [error]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-canvas px-4">
      <span className="grid size-20 place-items-center rounded-3xl bg-now/20 text-4xl shadow-float">
        ⏰
      </span>
      <div className="text-center">
        <h1 className="font-display text-3xl font-bold tracking-tight">
          Something slipped.
        </h1>
        <p className="mt-2 max-w-sm text-[15px] text-ink-soft">
          An unexpected error occurred. Your data is safe — this is just a
          rendering hiccup. Try again, or head back to Today.
        </p>
      </div>
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-iris px-6 py-3 text-[15px] font-semibold text-ink-inverse shadow-card transition-transform hover:scale-105"
        >
          Try again
        </button>
        <Link
          href="/app/today"
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-border bg-surface px-6 py-3 text-[15px] font-semibold text-ink-soft shadow-card transition-colors hover:bg-surface-sunken"
        >
          Back to Today
        </Link>
      </div>
    </div>
  );
}
