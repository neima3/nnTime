"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { signIn, signUp } from "@/lib/auth-client";

type Mode = "sign-in" | "sign-up";

/**
 * Email + password auth (ADR-003). Verification email is disabled until Resend
 * is provisioned, so sign-up signs the user straight in. Magic link needs the
 * server-side plugin + Resend transport (tracked as an ADR-003 follow-up).
 */
export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const isSignUp = mode === "sign-up";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const res = isSignUp
        ? await signUp.email({ email, password, name: name.trim() || email.split("@")[0] })
        : await signIn.email({ email, password });
      if (res.error) {
        setError(res.error.message ?? "Something went wrong. Please try again.");
        setPending(false);
        return;
      }
      router.push("/app/today");
      router.refresh();
    } catch {
      setError("Couldn't reach the server. Please try again.");
      setPending(false);
    }
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

            {error && (
              <p
                role="alert"
                className="rounded-xl bg-danger-soft px-3.5 py-2.5 text-[13px] font-medium text-danger"
              >
                {error}
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
