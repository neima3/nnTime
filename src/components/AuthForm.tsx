"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, Loader2, Mail } from "lucide-react";
import { signIn, signUp } from "@/lib/auth-client";
import { detectTimezone } from "@/lib/timezone";

type Mode = "sign-in" | "sign-up";

/**
 * Email + password auth (ADR-003). Magic link optional.
 * Without Resend: reset/magic still accept and return generic success
 * (no account enumeration); server logs the URL in non-production.
 */
export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [magicPending, setMagicPending] = useState(false);

  const isSignUp = mode === "sign-up";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setPending(true);
    try {
      const res = isSignUp
        ? await signUp.email({
            email,
            password,
            name: name.trim() || email.split("@")[0] || "Planner",
          })
        : await signIn.email({ email, password });
      if (res.error) {
        setError(res.error.message ?? "Something went wrong. Please try again.");
        setPending(false);
        return;
      }
      // Seed the planning timezone before Today first renders — settings are
      // created on first touch, and without this hint new accounts plan in UTC.
      try {
        await fetch("/api/v1/settings", {
          headers: { "x-timezone": detectTimezone() },
        });
      } catch {}
      router.push("/app/today");
      router.refresh();
    } catch {
      setError("Couldn't reach the server. Please try again.");
      setPending(false);
    }
  }

  async function onMagicLink() {
    if (!email.trim()) {
      setError("Enter your email first.");
      return;
    }
    setError(null);
    setInfo(null);
    setMagicPending(true);
    try {
      const res = await signIn.magicLink({
        email: email.trim(),
        callbackURL: "/app/today",
      });
      if (res.error) {
        setError(res.error.message ?? "Could not send magic link.");
        setMagicPending(false);
        return;
      }
      setInfo(
        "If that address is valid, a sign-in link is on the way. Check your inbox (and spam). Local dev logs the link in the server console when email isn't configured.",
      );
    } catch {
      setError("Couldn't reach the server. Please try again.");
    }
    setMagicPending(false);
  }

  return (
    <div className="grid min-h-dvh place-items-center bg-canvas px-5 py-10">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-8 flex items-center justify-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-xl bg-iris text-lg text-ink-inverse shadow-card">
            ◔
          </span>
          <span className="font-display text-xl font-bold tracking-tight">Kairo</span>
        </Link>

        <div className="rounded-3xl border border-border bg-surface p-7 shadow-float">
          <h1 className="font-display text-2xl font-bold tracking-tight">
            {isSignUp ? "Create your planner" : "Welcome back"}
          </h1>
          <p className="mt-1.5 text-[14px] text-ink-soft">
            {isSignUp
              ? "A gentle, visual day — ready in a moment."
              : "Sign in to pick up where you left off."}
          </p>

          <form onSubmit={onSubmit} className="mt-6 space-y-3.5">
            {isSignUp && (
              <Field
                label="Name"
                type="text"
                autoComplete="name"
                value={name}
                onChange={setName}
                placeholder="What should we call you?"
              />
            )}
            <Field
              label="Email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={setEmail}
              placeholder="you@example.com"
            />
            <Field
              label="Password"
              type="password"
              autoComplete={isSignUp ? "new-password" : "current-password"}
              required
              minLength={8}
              value={password}
              onChange={setPassword}
              placeholder={isSignUp ? "At least 8 characters" : "Your password"}
            />

            {!isSignUp && (
              <div className="flex justify-end">
                <Link
                  href="/forgot-password"
                  className="text-[13px] font-semibold text-iris hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
            )}

            {error && (
              <p
                role="alert"
                className="rounded-xl bg-danger-soft px-3.5 py-2.5 text-[13px] font-medium text-danger"
              >
                {error}
              </p>
            )}
            {info && (
              <p
                role="status"
                className="rounded-xl bg-iris-soft px-3.5 py-2.5 text-[13px] font-medium text-iris"
              >
                {info}
              </p>
            )}

            <button
              type="submit"
              disabled={pending}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-iris py-3 text-[15px] font-semibold text-ink-inverse shadow-card transition-all hover:bg-iris-deep disabled:cursor-not-allowed disabled:opacity-70"
            >
              {pending ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <>
                  {isSignUp ? "Create planner" : "Sign in"}
                  <ArrowRight size={17} />
                </>
              )}
            </button>
          </form>

          {!isSignUp && (
            <button
              type="button"
              disabled={magicPending}
              onClick={() => void onMagicLink()}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-surface py-3 text-[14px] font-semibold text-ink-soft transition-colors hover:bg-surface-sunken hover:text-ink disabled:opacity-70"
            >
              {magicPending ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <>
                  <Mail size={16} />
                  Email me a magic link
                </>
              )}
            </button>
          )}
        </div>

        <p className="mt-5 text-center text-[14px] text-ink-soft">
          {isSignUp ? "Already have a planner? " : "New to Kairo? "}
          <Link
            href={isSignUp ? "/sign-in" : "/sign-up"}
            className="font-semibold text-iris hover:underline"
          >
            {isSignUp ? "Sign in" : "Create one"}
          </Link>
        </p>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  ...rest
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-semibold text-ink-soft">{label}</span>
      <input
        {...rest}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-border bg-surface-sunken px-3.5 py-2.5 text-[15px] text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-iris focus:bg-surface focus:ring-2 focus:ring-iris/30"
      />
    </label>
  );
}

