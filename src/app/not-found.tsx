/**
 * Custom 404 — Kairo branded. Keeps the Soft Focus design system.
 */
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-canvas px-4">
      <span className="grid size-20 place-items-center rounded-3xl bg-iris text-4xl text-ink-inverse shadow-float">
        ◔
      </span>
      <div className="text-center">
        <h1 className="font-display text-4xl font-bold tracking-tight">
          Lost track of time?
        </h1>
        <p className="mt-2 text-[15px] text-ink-soft">
          We couldn&apos;t find that page. Let&apos;s get you back on schedule.
        </p>
      </div>
      <Link
        href="/app/today"
        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-iris px-6 py-3 text-[15px] font-semibold text-ink-inverse shadow-card transition-transform hover:scale-105"
      >
        Back to Today
      </Link>
    </div>
  );
}
