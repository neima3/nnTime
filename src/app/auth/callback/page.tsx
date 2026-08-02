import type { Metadata } from "next";
import Link from "next/link";
import { parseMagicCallbackToken } from "@/server/native-magic-link";

export const metadata: Metadata = {
  title: "Open your sign-in link",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function MagicLinkCallbackPage({
  searchParams,
}: {
  searchParams: Promise<{
    token?: string | string[];
  }>;
}) {
  const token = parseMagicCallbackToken((await searchParams).token);

  return (
    <main className="grid min-h-dvh place-items-center bg-canvas px-5 py-10">
      <section className="w-full max-w-sm rounded-3xl border border-border bg-surface p-7 text-center shadow-float">
        <div className="mx-auto mb-5 flex justify-center">
          <span
            aria-hidden="true"
            className="grid size-13 place-items-center rounded-2xl bg-iris text-2xl text-ink-inverse shadow-card"
          >
            ◔
          </span>
        </div>
        {token ? (
          <>
            <h1 className="font-display text-2xl font-bold tracking-tight text-ink">
              Finish signing in
            </h1>
            <p className="mt-2 text-[14px] leading-relaxed text-ink-soft">
              Open Kairo on your iPhone, or continue securely in this browser.
              This link works once.
            </p>
            <div className="mt-6 grid gap-3">
              <a
                href={`kairo://auth?token=${encodeURIComponent(token)}`}
                className="rounded-2xl bg-iris px-4 py-3 text-[15px] font-semibold text-ink-inverse shadow-card transition-colors hover:bg-iris-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-iris"
              >
                Open Kairo
              </a>
              <a
                href={`/api/auth/magic-link/verify?token=${encodeURIComponent(token)}&callbackURL=%2Fapp%2Ftoday`}
                className="rounded-2xl border border-border bg-surface px-4 py-3 text-[14px] font-semibold text-ink-soft transition-colors hover:bg-surface-sunken hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-iris"
              >
                Continue in browser
              </a>
            </div>
          </>
        ) : (
          <>
            <h1 className="font-display text-2xl font-bold tracking-tight text-ink">
              This link isn’t available
            </h1>
            <p className="mt-2 text-[14px] leading-relaxed text-ink-soft">
              It may be incomplete or expired. Request a fresh sign-in link
              and try again.
            </p>
            <Link
              href="/sign-in"
              className="mt-6 block rounded-2xl bg-iris px-4 py-3 text-[15px] font-semibold text-ink-inverse shadow-card"
            >
              Back to sign in
            </Link>
          </>
        )}
      </section>
    </main>
  );
}
