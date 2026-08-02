"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useId, useRef, useState } from "react";
import { ArrowRight, Eye, EyeOff, Loader2, Mail } from "lucide-react";
import { signIn, signUp } from "@/lib/auth-client";
import { detectTimezone } from "@/lib/timezone";
import type { AuthCapabilities } from "@/server/auth-capabilities";
import {
  acquireAuthRequest,
  releaseAuthRequest,
} from "./auth-request-guard";
import { signInWithGoogle } from "./google-auth-integration";
import {
  authPageHref,
  DEFAULT_AUTH_RETURN_TO,
  safeAuthReturnTo,
} from "@/lib/auth-return";

type Mode = "sign-in" | "sign-up";

/**
 * Email + password auth (ADR-003). Magic link optional.
 * Without Resend: reset/magic still accept and return generic success
 * (no account enumeration); server logs the URL in non-production.
 */
export function AuthForm({
  mode,
  capabilities,
  initialError = null,
  returnTo = DEFAULT_AUTH_RETURN_TO,
}: {
  mode: Mode;
  capabilities: AuthCapabilities;
  initialError?: string | null;
  returnTo?: string;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [error, setError] = useState<string | null>(initialError);
  const [info, setInfo] = useState<string | null>(null);
  const [busyAction, setBusyAction] =
    useState<"email" | "magic" | "google" | null>(null);
  const authLock = useRef(false);

  const isSignUp = mode === "sign-up";
  const authBusy = busyAction !== null;
  const safeReturnTo = safeAuthReturnTo(returnTo);

  function finishAuthRequest() {
    releaseAuthRequest(authLock);
    setBusyAction(null);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!acquireAuthRequest(authLock)) return;
    setError(null);
    setInfo(null);
    setBusyAction("email");
    try {
      const res = isSignUp
        ? await signUp.email({
            email,
            password,
            name: name.trim() || email.split("@")[0] || "Planner",
          })
        : await signIn.email({ email, password });
      if (res.error) {
        setError(res.error.message ?? "That didn't go through — check your email and password?");
        finishAuthRequest();
        return;
      }
      // Seed the planning timezone before Today first renders — settings are
      // created on first touch, and without this hint new accounts plan in UTC.
      try {
        await fetch("/api/v1/settings", {
          headers: { "x-timezone": detectTimezone() },
        });
      } catch {}
      router.push(safeReturnTo);
      router.refresh();
    } catch {
      setError("Couldn't reach the server — try again?");
      finishAuthRequest();
    }
  }

  async function onMagicLink() {
    if (!email.trim()) {
      setError("Enter your email first.");
      return;
    }
    if (!acquireAuthRequest(authLock)) return;
    setError(null);
    setInfo(null);
    setBusyAction("magic");
    try {
      const res = await signIn.magicLink({
        email: email.trim(),
        callbackURL: safeReturnTo,
      });
      if (res.error) {
        setError(res.error.message ?? "Couldn't send that link — try again?");
        return;
      }
      setPassword("");
      setPasswordVisible(false);
      setInfo(
        "If that address is valid, a sign-in link is on the way. Check your inbox (and spam).",
      );
    } catch {
      setError("Couldn't reach the server — try again?");
    } finally {
      finishAuthRequest();
    }
  }

  function onGoogleSignIn() {
    void signInWithGoogle({
      mode,
      returnTo: safeReturnTo,
      lock: authLock,
      setPending: (pending) => setBusyAction(pending ? "google" : null),
      setError,
    });
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
              passwordVisible={passwordVisible}
              onTogglePassword={() => setPasswordVisible((visible) => !visible)}
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
              disabled={authBusy}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-iris py-3 text-[15px] font-semibold text-ink-inverse shadow-card transition-all hover:bg-iris-deep disabled:cursor-not-allowed disabled:opacity-70"
            >
              {busyAction === "email" ? (
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
              disabled={authBusy}
              onClick={() => void onMagicLink()}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-surface py-3 text-[14px] font-semibold text-ink-soft transition-colors hover:bg-surface-sunken hover:text-ink disabled:opacity-70"
            >
              {busyAction === "magic" ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <>
                  <Mail size={16} />
                  Email me a magic link
                </>
              )}
            </button>
          )}

          {capabilities.google && (
            <>
              <div className="my-4 flex items-center gap-3" aria-hidden="true">
                <span className="h-px flex-1 bg-border" />
                <span className="text-[12px] font-medium text-ink-faint">
                  or continue with
                </span>
                <span className="h-px flex-1 bg-border" />
              </div>
              <button
                type="button"
                aria-label="Continue with Google"
                aria-busy={busyAction === "google"}
                disabled={authBusy}
                onClick={onGoogleSignIn}
                className="flex min-h-11 w-full items-center justify-center gap-2.5 rounded-2xl border border-border bg-surface px-4 text-[14px] font-semibold text-ink-soft transition-colors hover:bg-surface-sunken hover:text-ink focus-visible:ring-2 focus-visible:ring-iris focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-70"
              >
                {busyAction === "google" ? (
                  <>
                    <Loader2 size={18} className="animate-spin" aria-hidden="true" />
                    Connecting…
                  </>
                ) : (
                  <>
                    <Image
                      src="/brand/google-g.png"
                      alt=""
                      aria-hidden="true"
                      width={40}
                      height={40}
                      unoptimized
                      className="size-7 shrink-0"
                    />
                    Continue with Google
                  </>
                )}
              </button>
            </>
          )}

          {isSignUp && (
            <p className="mt-4 text-center text-[12px] leading-relaxed text-ink-faint">
              Your planner is personal. Learn how Kairo handles your information
              in our{" "}
              <Link
                href="/privacy"
                className="font-semibold text-iris hover:underline"
              >
                Privacy Policy
              </Link>
              .
            </p>
          )}
        </div>

        <p className="mt-5 text-center text-[14px] text-ink-soft">
          {isSignUp ? "Already have a planner? " : "New to Kairo? "}
          <Link
            href={authPageHref(
              isSignUp ? "sign-in" : "sign-up",
              safeReturnTo,
            )}
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
  type,
  passwordVisible,
  onTogglePassword,
  ...rest
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type: React.HTMLInputTypeAttribute;
  passwordVisible?: boolean;
  onTogglePassword?: () => void;
} & Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "type" | "value" | "onChange"
>) {
  const inputId = useId();
  const hasPasswordToggle =
    typeof passwordVisible === "boolean" && Boolean(onTogglePassword);

  return (
    <div>
      <label
        htmlFor={inputId}
        className="mb-1.5 block text-[13px] font-semibold text-ink-soft"
      >
        {label}
      </label>
      <div className="relative">
        <input
          {...rest}
          id={inputId}
          type={hasPasswordToggle && passwordVisible ? "text" : type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full rounded-xl border border-border bg-surface-sunken px-3.5 py-2.5 text-[15px] text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-iris focus:bg-surface focus:ring-2 focus:ring-iris/30 ${
            hasPasswordToggle ? "pr-12" : ""
          }`}
        />
        {hasPasswordToggle && (
          <button
            type="button"
            aria-label="Show password"
            aria-pressed={passwordVisible}
            aria-controls={inputId}
            onClick={onTogglePassword}
            className="absolute right-0 top-1/2 grid min-h-11 min-w-11 -translate-y-1/2 place-items-center rounded-r-xl text-ink-faint transition-colors hover:bg-iris-ghost hover:text-ink focus-visible:bg-iris-ghost active:bg-iris-soft"
          >
            {passwordVisible ? (
              <EyeOff size={18} aria-hidden="true" />
            ) : (
              <Eye size={18} aria-hidden="true" />
            )}
          </button>
        )}
      </div>
    </div>
  );
}
