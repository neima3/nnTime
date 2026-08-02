import type { Metadata } from "next";
import Link from "next/link";
import { ResetPasswordForm } from "./ResetPasswordForm";
import { ResetUnavailableCard } from "./ResetUnavailableCard";
import { safeAuthReturnTo } from "@/lib/auth-return";

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

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{
    token?: string | string[];
    next?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const token = resetToken(params.token);
  const returnTo = safeAuthReturnTo(params.next);

  return (
    <main className="grid min-h-dvh place-items-center bg-canvas px-5 py-10">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-8 flex items-center justify-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-xl bg-iris text-lg text-ink-inverse shadow-card">
            ◔
          </span>
          <span className="font-display text-xl font-bold tracking-tight">Kairo</span>
        </Link>
        {token ? (
          <ResetPasswordForm token={token} returnTo={returnTo} />
        ) : (
          <ResetUnavailableCard returnTo={returnTo} />
        )}
      </div>
    </main>
  );
}
