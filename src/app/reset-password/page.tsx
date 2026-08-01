import type { Metadata } from "next";
import Link from "next/link";
import { ResetPasswordForm } from "./ResetPasswordForm";

export const metadata: Metadata = {
  title: "Choose a new password · Kairo",
  robots: {
    index: false,
    follow: false,
  },
};

function resetToken(value: string | string[] | undefined): string | null {
  if (typeof value !== "string") return null;
  return value.trim() || null;
}

function UnavailableResetLink() {
  return (
    <div className="rounded-3xl border border-border bg-surface p-7 text-center shadow-float">
      <h1 className="font-display text-2xl font-bold tracking-tight text-ink">
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

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const token = resetToken((await searchParams).token);

  return (
    <main className="grid min-h-dvh place-items-center bg-canvas px-5 py-10">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-8 flex items-center justify-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-xl bg-iris text-lg text-ink-inverse shadow-card">
            ◔
          </span>
          <span className="font-display text-xl font-bold tracking-tight">Kairo</span>
        </Link>
        {token ? <ResetPasswordForm token={token} /> : <UnavailableResetLink />}
      </div>
    </main>
  );
}
