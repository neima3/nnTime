"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { resetPassword } from "@/lib/auth-client";
import { ResetUnavailableCard } from "./ResetUnavailableCard";

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
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
          setLinkUnavailable(true);
          return;
        }
        setError(res.error.message ?? "Couldn't reset your password — try again.");
        setPending(false);
        return;
      }
      router.push("/sign-in");
    } catch {
      setError("Couldn't reach the server — try again?");
      setPending(false);
    }
  }

  if (linkUnavailable) {
    return <ResetUnavailableCard focusOnMount />;
  }

  return (
    <div className="rounded-3xl border border-border bg-surface p-7 shadow-float">
      <h1 className="font-display text-2xl font-bold tracking-tight">
        Choose a new password
      </h1>
      <p className="mt-1.5 text-[14px] text-ink-soft">At least 8 characters.</p>
      <form onSubmit={onSubmit} className="mt-6 space-y-3.5">
        <label className="block">
          <span className="mb-1.5 block text-[13px] font-semibold text-ink-soft">
            New password
          </span>
          <input
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-border bg-surface-sunken px-3.5 py-2.5 text-[15px] outline-none focus:border-iris focus:ring-2 focus:ring-iris/30"
          />
        </label>
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
        <Link href="/sign-in" className="font-semibold text-iris hover:underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
