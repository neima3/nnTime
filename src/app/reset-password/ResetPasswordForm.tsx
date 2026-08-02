"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { resetPassword } from "@/lib/auth-client";
import { PasswordField } from "@/components/PasswordField";
import { ResetUnavailableCard } from "./ResetUnavailableCard";
import { authPageHref, safeAuthReturnTo } from "@/lib/auth-return";

export function ResetPasswordForm({
  token,
  returnTo,
}: {
  token: string;
  returnTo: string;
}) {
  const router = useRouter();
  const safeReturnTo = safeAuthReturnTo(returnTo);
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkUnavailable, setLinkUnavailable] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const res = await resetPassword({
        newPassword: password,
        token,
      });
      if (res.error) {
        if (res.error.code === "INVALID_TOKEN") {
          setPassword("");
          setPasswordVisible(false);
          setLinkUnavailable(true);
          return;
        }
        setError(res.error.message ?? "Couldn't reset your password — try again.");
        setPending(false);
        return;
      }
      router.push(authPageHref("sign-in", safeReturnTo));
    } catch {
      setError("Couldn't reach the server — try again?");
      setPending(false);
    }
  }

  if (linkUnavailable) {
    return <ResetUnavailableCard returnTo={safeReturnTo} focusOnMount />;
  }

  return (
    <div className="rounded-3xl border border-border bg-surface p-7 shadow-float">
      <h1 className="font-display text-2xl font-bold tracking-tight">
        Choose a new password
      </h1>
      <p className="mt-1.5 text-[14px] text-ink-soft">At least 8 characters.</p>
      <form onSubmit={onSubmit} className="mt-6 space-y-3.5">
        <PasswordField
          label="New password"
          required
          minLength={8}
          autoComplete="new-password"
          value={password}
          onChange={setPassword}
          visible={passwordVisible}
          onVisibleChange={setPasswordVisible}
        />
        {error && (
          <p role="alert" className="text-[13px] font-semibold text-danger">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-iris py-3 text-[15px] font-semibold text-ink-inverse disabled:opacity-70"
        >
          {pending ? <Loader2 size={18} className="animate-spin" /> : "Update password"}
        </button>
      </form>
      <p className="mt-4 text-center text-[13px] text-ink-soft">
        <Link
          href={authPageHref("sign-in", safeReturnTo)}
          className="font-semibold text-iris hover:underline"
        >
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
