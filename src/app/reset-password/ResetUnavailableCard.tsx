"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

export function ResetUnavailableCard({
  focusOnMount = false,
}: {
  focusOnMount?: boolean;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (focusOnMount) headingRef.current?.focus();
  }, [focusOnMount]);

  return (
    <div className="rounded-3xl border border-border bg-surface p-7 text-center shadow-float">
      <h1
        ref={headingRef}
        tabIndex={focusOnMount ? -1 : undefined}
        className="font-display text-2xl font-bold tracking-tight text-ink outline-none"
      >
        This reset link isn’t available
      </h1>
      <p className="mt-2 text-[14px] leading-relaxed text-ink-soft">
        It may be incomplete or expired. Request a fresh password reset link
        and try again.
      </p>
      <Link
        href="/forgot-password"
        className="mt-6 block rounded-2xl bg-iris px-4 py-3 text-[15px] font-semibold text-ink-inverse shadow-card transition-colors hover:bg-iris-deep"
      >
        Request a new reset link
      </Link>
      <Link
        href="/sign-in"
        className="mt-3 block text-[13px] font-semibold text-iris hover:underline"
      >
        Back to sign in
      </Link>
    </div>
  );
}
