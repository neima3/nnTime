import Link from "next/link";
import { LogIn, type LucideIcon } from "lucide-react";

/**
 * Shared signed-out + loading presentation for client screens.
 * Soft Focus tokens only — see docs/design/design-spec.md.
 */

export function SignedOutCard({
  icon: Icon,
  title,
  body,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
}) {
  return (
    <section className="mx-auto max-w-md rounded-3xl border border-border bg-surface px-6 py-10 text-center shadow-card">
      <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-iris-ghost text-iris">
        <Icon size={26} strokeWidth={2.2} />
      </span>
      <h2 className="mt-4 font-display text-xl font-bold tracking-tight">{title}</h2>
      <p className="mx-auto mt-1.5 max-w-xs text-[14px] leading-relaxed text-ink-soft">{body}</p>
      <Link
        href="/sign-in"
        className="mt-6 inline-flex items-center gap-2 rounded-xl bg-iris px-5 py-2.5 text-[14px] font-semibold text-ink-inverse shadow-card transition-transform hover:scale-[1.03] focus-visible:ring-2 focus-visible:ring-iris focus-visible:outline-none"
      >
        <LogIn size={16} />
        Sign in
      </Link>
      <p className="mt-3 text-[12px] text-ink-faint">
        New here?{" "}
        <Link href="/sign-up" className="font-semibold text-iris hover:underline">
          Create an account
        </Link>
      </p>
    </section>
  );
}

export function SkeletonCards({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2" aria-busy="true" aria-label="Loading">
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className="rounded-3xl border border-border bg-surface p-5 shadow-card"
          style={{ opacity: 1 - i * 0.12 }}
        >
          <div className="h-5 w-28 animate-pulse rounded-lg bg-surface-sunken" />
          <div className="mt-2 h-3.5 w-44 animate-pulse rounded-lg bg-surface-sunken" />
          <div className="mt-5 h-20 animate-pulse rounded-2xl bg-surface-sunken" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonRows({ count = 5 }: { count?: number }) {
  return (
    <div
      className="divide-y divide-border rounded-3xl border border-border bg-surface shadow-card"
      aria-busy="true"
      aria-label="Loading"
    >
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex items-center justify-between gap-4 px-5 py-4">
          <div className="space-y-2">
            <div className="h-4 w-32 animate-pulse rounded-lg bg-surface-sunken" />
            <div className="h-3 w-48 animate-pulse rounded-lg bg-surface-sunken" />
          </div>
          <div className="h-7 w-12 animate-pulse rounded-full bg-surface-sunken" />
        </div>
      ))}
    </div>
  );
}
