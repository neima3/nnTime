"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { requestPasswordReset } from "@/lib/auth-client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const res = await requestPasswordReset({
        email: email.trim(),
        redirectTo: "/reset-password",
      });
      if (res.error) {
        // Still show generic success for enumeration safety if API is odd.
        setError(res.error.message ?? "Could not start reset.");
        setPending(false);
        return;
      }
      setDone(true);
    } catch {
      setError("Couldn't reach the server.");
    }
    setPending(false);
  }

  return (
    <div className="grid min-h-dvh place-items-center bg-canvas px-5 py-10">
      <div className="w-full max-w-sm">
        <Link
          href="/sign-in"
          className="mb-6 inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink-soft hover:text-ink"
        >
          <ArrowLeft size={15} />
          Back to sign in
        </Link>
        <div className="rounded-3xl border border-border bg-surface p-7 shadow-float">
          <h1 className="font-display text-2xl font-bold tracking-tight">
            Reset password
          </h1>
          <p className="mt-1.5 text-[14px] text-ink-soft">
            We&apos;ll send a reset link if that email has a Kairo account.
          </p>

          {done ? (
            <p
              role="status"
              className="mt-6 rounded-xl bg-iris-soft px-3.5 py-3 text-[13px] font-medium leading-relaxed text-iris"
            >
              If an account exists for that address, a reset link is on the way.
              Check spam too. In local dev without email configured, the link is
              printed in the server logs.
            </p>
          ) : (
            <form onSubmit={onSubmit} className="mt-6 space-y-3.5">
              <label className="block">
                <span className="mb-1.5 block text-[13px] font-semibold text-ink-soft">
                  Email
                </span>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-border bg-surface-sunken px-3.5 py-2.5 text-[15px] outline-none focus:border-iris focus:ring-2 focus:ring-iris/30"
                  placeholder="you@example.com"
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
                {pending ? <Loader2 size={18} className="animate-spin" /> : "Send reset link"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
