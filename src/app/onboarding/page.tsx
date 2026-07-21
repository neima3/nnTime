"use client";

/**
 * Onboarding 2.0 (wave 4) — build a real first day in under a minute.
 * Three steps, all skippable, zero configuration dumps (research:
 * over-configured onboarding is a top ADHD-app complaint):
 *   1. Hello — name (optional) + auto-detected timezone confirm
 *   2. Anchors — tap starter blocks; one Create makes real activities
 *   3. Superpowers — the three things to remember, then into Today
 * Signed-out users are sent to sign-up first (their day needs an account).
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Loader2 } from "lucide-react";
import { detectTimezone } from "@/lib/timezone";
import { clientToday } from "@/lib/client-date";
import { localMinutesToInstant } from "@/lib/adapters";

interface Anchor {
  emoji: string;
  title: string;
  startMin: number;
  durationMin: number;
  /** Daily anchors repeat; one-offs don't. */
  daily: boolean;
  hint: string;
}

const ANCHORS: Anchor[] = [
  { emoji: "🌤", title: "Morning reset", startMin: 8 * 60, durationMin: 30, daily: true, hint: "8:00 · every day" },
  { emoji: "💊", title: "Meds + breakfast", startMin: 8 * 60 + 30, durationMin: 15, daily: true, hint: "8:30 · every day" },
  { emoji: "🎨", title: "Deep work block", startMin: 9 * 60 + 30, durationMin: 90, daily: false, hint: "9:30 · today" },
  { emoji: "🍜", title: "Real lunch, no desk", startMin: 12 * 60 + 30, durationMin: 45, daily: false, hint: "12:30 · today" },
  { emoji: "🏃", title: "Move a little", startMin: 17 * 60, durationMin: 30, daily: false, hint: "17:00 · today" },
  { emoji: "🌙", title: "Wind-down", startMin: 21 * 60 + 30, durationMin: 30, daily: true, hint: "21:30 · every day" },
];

function StepDots({ step }: { step: number }) {
  return (
    <div className="mb-6 flex items-center justify-center gap-2" aria-label={`Step ${step} of 3`}>
      {[1, 2, 3].map((s) => (
        <span
          key={s}
          className={
            s === step
              ? "h-2 w-6 rounded-full bg-iris transition-all"
              : s < step
                ? "size-2 rounded-full bg-iris/50 transition-all"
                : "size-2 rounded-full bg-border-strong transition-all"
          }
        />
      ))}
    </div>
  );
}

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [picked, setPicked] = useState<Set<number>>(() => new Set([0, 2, 5]));
  const [busy, setBusy] = useState(false);
  const [createdCount, setCreatedCount] = useState<number | null>(null);
  const [zone, setZone] = useState("UTC");

  // Resume where they left off — onboarding survives a refresh or a wandered-off
  // tab (ADHD reality). Restored after hydration to avoid a mismatch.
  useEffect(() => {
    try {
      const raw = localStorage.getItem("kairo:onboarding");
      if (!raw) return;
      const saved = JSON.parse(raw) as {
        step?: number;
        name?: string;
        picked?: number[];
      };
      /* eslint-disable react-hooks/set-state-in-effect */
      if (saved.step && saved.step >= 1 && saved.step <= 2) setStep(saved.step);
      if (typeof saved.name === "string") setName(saved.name);
      if (Array.isArray(saved.picked)) setPicked(new Set(saved.picked));
      /* eslint-enable react-hooks/set-state-in-effect */
    } catch {}
  }, []);

  // Persist progress on every change (cleared once anchors are created).
  useEffect(() => {
    try {
      localStorage.setItem(
        "kairo:onboarding",
        JSON.stringify({ step, name, picked: [...picked] }),
      );
    } catch {}
  }, [step, name, picked]);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    const z = detectTimezone();
    setZone(z);
    /* eslint-enable react-hooks/set-state-in-effect */
    let cancelled = false;
    // Seed timezone on the settings row while we're here (idempotent).
    fetch("/api/v1/settings", { headers: { "x-timezone": z } })
      .then((r) => {
        if (!cancelled) setAuthed(r.ok);
      })
      .catch(() => {
        if (!cancelled) setAuthed(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const toggle = (i: number) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  const createAnchors = async () => {
    setBusy(true);
    const today = clientToday(zone);
    let created = 0;
    for (const i of [...picked].sort((a, b) => a - b)) {
      const a = ANCHORS[i]!;
      try {
        const res = await fetch("/api/v1/activities", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tz: zone,
            dtstartLocal: localMinutesToInstant(today, a.startMin, zone),
            rrule: a.daily ? "FREQ=DAILY" : null,
            title: a.title,
            emoji: a.emoji,
            durationMin: a.durationMin,
            source: "manual",
          }),
        });
        if (res.ok) created++;
      } catch {}
    }
    setCreatedCount(created);
    setBusy(false);
    // Reached the finish — onboarding is done, forget the saved progress.
    try {
      localStorage.removeItem("kairo:onboarding");
    } catch {}
    setStep(3);
  };

  return (
    <main className="grid min-h-dvh place-items-center bg-canvas px-5 py-10">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-8 flex items-center justify-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-xl bg-iris text-lg text-ink-inverse shadow-card">
            ◔
          </span>
          <span className="font-display text-xl font-bold tracking-tight">Kairo</span>
        </Link>

        <div className="rounded-3xl border border-border bg-surface p-7 shadow-float">
          <StepDots step={step} />

          {step === 1 && (
            <div className="rise-in">
              <h1 className="font-display text-2xl font-bold tracking-tight">
                A minute of setup. Genuinely one minute.
              </h1>
              <p className="mt-2 text-[14.5px] leading-relaxed text-ink-soft">
                No 20-question quiz — planners that start with homework never
                get opened twice.
              </p>
              <label className="mt-5 block">
                <span className="mb-1.5 block text-[13px] font-semibold text-ink-soft">
                  What should we call you? (optional)
                </span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Just a first name is plenty"
                  className="w-full rounded-xl border border-border bg-surface-sunken px-3.5 py-2.5 text-[15px] outline-none transition-colors placeholder:text-ink-faint focus:border-iris focus:bg-surface focus:ring-2 focus:ring-iris/30"
                />
              </label>
              <p className="mt-3 text-[13px] text-ink-soft">
                Planning timezone:{" "}
                <span className="font-semibold text-ink">{zone}</span>{" "}
                <span className="text-ink-faint">
                  (auto-detected — change anytime in Settings)
                </span>
              </p>
              <button
                type="button"
                onClick={() => setStep(2)}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-iris py-3 text-[15px] font-semibold text-ink-inverse shadow-card transition-all hover:bg-iris-deep active:scale-[0.98]"
              >
                Next <ArrowRight size={16} />
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="rise-in">
              <h1 className="font-display text-2xl font-bold tracking-tight">
                {name.trim() ? `${name.trim()}, pick` : "Pick"} your anchors.
              </h1>
              <p className="mt-2 text-[14.5px] leading-relaxed text-ink-soft">
                A day with two or three anchors already has a shape. Tap what
                fits — times are just starting points, drag them later.
              </p>
              <div className="mt-5 grid grid-cols-2 gap-2">
                {ANCHORS.map((a, i) => {
                  const on = picked.has(i);
                  return (
                    <button
                      key={a.title}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggle(i)}
                      className={`rounded-2xl border p-3 text-left transition-all active:scale-[0.98] ${
                        on
                          ? "border-iris bg-iris-soft shadow-card"
                          : "border-border bg-surface hover:bg-surface-sunken"
                      }`}
                    >
                      <span className="flex items-start justify-between">
                        <span className="text-xl" aria-hidden>
                          {a.emoji}
                        </span>
                        {on && (
                          <Check size={15} className="text-iris" strokeWidth={3} />
                        )}
                      </span>
                      <span className="mt-1.5 block text-[13.5px] font-bold leading-tight">
                        {a.title}
                      </span>
                      <span className="tnum mt-0.5 block text-[11.5px] font-medium text-ink-soft">
                        {a.hint}
                      </span>
                    </button>
                  );
                })}
              </div>

              {authed === false ? (
                <div className="mt-6">
                  <p className="text-[13px] text-ink-soft">
                    You&apos;ll need a (free) planner to save these:
                  </p>
                  <Link
                    href="/sign-up"
                    className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-iris py-3 text-[15px] font-semibold text-ink-inverse shadow-card transition-all hover:bg-iris-deep"
                  >
                    Create my planner <ArrowRight size={16} />
                  </Link>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={busy || picked.size === 0 || authed == null}
                  onClick={() => void createAnchors()}
                  className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-iris py-3 text-[15px] font-semibold text-ink-inverse shadow-card transition-all hover:bg-iris-deep active:scale-[0.98] disabled:opacity-60"
                >
                  {busy ? (
                    <Loader2 size={17} className="animate-spin" />
                  ) : (
                    <>
                      Create {picked.size} anchor{picked.size === 1 ? "" : "s"}
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  try {
                    localStorage.removeItem("kairo:onboarding");
                  } catch {}
                  setStep(3);
                }}
                className="mt-2 w-full rounded-2xl py-2.5 text-[13px] font-semibold text-ink-faint hover:bg-surface-sunken"
              >
                Skip — I&apos;ll build my own
              </button>
            </div>
          )}

          {step === 3 && (
            <div className="rise-in">
              <h1 className="font-display text-2xl font-bold tracking-tight">
                {createdCount != null && createdCount > 0
                  ? `${createdCount} anchor${createdCount === 1 ? "" : "s"} on your timeline.`
                  : "You're in."}
              </h1>
              <p className="mt-2 text-[14.5px] text-ink-soft">
                Three superpowers worth remembering:
              </p>
              <ul className="mt-4 space-y-3">
                <li className="flex items-start gap-3 rounded-2xl border border-border bg-surface-sunken p-3.5">
                  <kbd className="rounded-lg bg-surface px-2 py-1 font-mono text-[13px] font-bold shadow-card">
                    C
                  </kbd>
                  <div>
                    <p className="text-[14px] font-bold">Capture anything, anywhere</p>
                    <p className="text-[12.5px] text-ink-soft">
                      A thought lands in your inbox in three seconds — head stays clear.
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3 rounded-2xl border border-border bg-surface-sunken p-3.5">
                  <span className="text-lg" aria-hidden>
                    🎲
                  </span>
                  <div>
                    <p className="text-[14px] font-bold">&ldquo;Pick for me&rdquo; when stuck</p>
                    <p className="text-[12.5px] text-ink-soft">
                      One button chooses your next thing. Starting stops being a decision.
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3 rounded-2xl border border-border bg-surface-sunken p-3.5">
                  <span className="text-lg" aria-hidden>
                    🃏
                  </span>
                  <div>
                    <p className="text-[14px] font-bold">Brain breaks are built in</p>
                    <p className="text-[12.5px] text-ink-soft">
                      Two-minute games between things — rest that actually ends.
                    </p>
                  </div>
                </li>
              </ul>
              <button
                type="button"
                onClick={() => {
                  router.push("/app/today");
                  router.refresh();
                }}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-iris py-3 text-[15px] font-semibold text-ink-inverse shadow-card transition-all hover:bg-iris-deep active:scale-[0.98]"
              >
                See my day <ArrowRight size={16} />
              </button>
            </div>
          )}
        </div>

        <p className="mt-5 text-center text-[13px] text-ink-faint">
          Every step is skippable. Nothing here is a commitment.
        </p>
      </div>
    </main>
  );
}
