"use client";

/**
 * Live focus session UI — ADR-004 (10× Phase 6).
 * Server-authoritative remaining time; pause/resume/complete/extend.
 */

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Pause, Play, Plus, SkipForward } from "lucide-react";

type Session = {
  id: string;
  state: "running" | "paused" | "completed" | "skipped" | "cancelled";
  targetDurationMin: number;
  startedAt: string;
};

function fmtRemain(sec: number) {
  const s = Math.max(0, sec);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

function FocusRing({
  remainingSec,
  targetMin,
  emoji,
}: {
  remainingSec: number;
  targetMin: number;
  emoji: string;
}) {
  const targetSec = targetMin * 60;
  const elapsedPct = targetSec > 0 ? 1 - remainingSec / targetSec : 0;
  const size = 300;
  const r = 128;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--cat-sky)"
          strokeWidth="18"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--cat-sky-ink)"
          strokeWidth="18"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * Math.min(1, Math.max(0, elapsedPct))}
          style={{ transition: "stroke-dashoffset 1s linear" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-5xl" aria-hidden>
          {emoji}
        </span>
        <p className="tnum mt-3 font-mono text-5xl font-semibold tracking-tight">
          {fmtRemain(remainingSec)}
        </p>
        <p className="mt-1 text-sm font-medium text-ink-soft">
          remaining of {targetMin} min
        </p>
      </div>
    </div>
  );
}

export function FocusClient({
  defaultTitle,
  defaultEmoji,
  defaultDurationMin,
  activityId,
  steps = [],
}: {
  defaultTitle: string;
  defaultEmoji: string;
  defaultDurationMin: number;
  activityId?: string;
  steps?: string[];
}) {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [remainingSec, setRemainingSec] = useState(defaultDurationMin * 60);
  const [title, setTitle] = useState(defaultTitle);
  const [emoji, setEmoji] = useState(defaultEmoji);
  const [durationMin, setDurationMin] = useState(defaultDurationMin);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const hydrate = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/focus-sessions");
      if (res.status === 401) {
        setLoading(false);
        return;
      }
      if (!res.ok) {
        setLoading(false);
        return;
      }
      const data = await res.json();
      if (data.session) {
        setSession(data.session);
        setRemainingSec(data.remainingSec ?? 0);
      }
    } catch {
      /* offline */
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    // Load active session after mount (auth-bound fetch; no SSR session object).
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/v1/focus-sessions");
        if (cancelled) return;
        if (res.status === 401 || !res.ok) {
          setLoading(false);
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        if (data.session) {
          setSession(data.session);
          setRemainingSec(data.remainingSec ?? 0);
        }
      } catch {
        /* offline */
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Local tick while running (server is source of truth; rehydrate periodically).
  useEffect(() => {
    if (!session || session.state !== "running") return;
    const tick = setInterval(() => {
      setRemainingSec((s) => Math.max(0, s - 1));
    }, 1000);
    const rehydrate = setInterval(() => {
      void hydrate();
    }, 15000);
    return () => {
      clearInterval(tick);
      clearInterval(rehydrate);
    };
  }, [session, hydrate]);

  const start = useCallback(async () => {
    setError(null);
    const res = await fetch("/api/v1/focus-sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        targetDurationMin: durationMin,
        title,
        emoji,
      }),
    });
    if (res.status === 401) {
      setError("Sign in to start a focus session.");
      return;
    }
    if (!res.ok) {
      setError("Could not start focus session.");
      return;
    }
    const data = await res.json();
    setSession(data.session);
    setRemainingSec(data.remainingSec);
  }, [durationMin, title, emoji]);

  const patch = useCallback(
    async (body: Record<string, unknown>) => {
      if (!session) return;
      setError(null);
      const res = await fetch(`/api/v1/focus-sessions/${session.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        setError("Action failed.");
        return;
      }
      const data = await res.json();
      setSession(data.session);
      setRemainingSec(data.remainingSec ?? 0);
      if (
        data.session.state === "completed" ||
        data.session.state === "skipped" ||
        data.session.state === "cancelled"
      ) {
        router.refresh();
      }
    },
    [session, router],
  );

  if (loading) {
    return (
      <div
        className="mx-auto flex min-h-[calc(100dvh-6rem)] max-w-2xl flex-col items-center px-4 py-10 md:min-h-dvh md:justify-center"
        aria-busy="true"
        aria-label="Loading focus"
      >
        <div className="h-4 w-16 animate-pulse rounded-lg bg-surface-sunken" />
        <div className="mt-3 h-8 w-48 animate-pulse rounded-xl bg-surface-sunken" />
        <div className="mt-10 size-[300px] animate-pulse rounded-full border-[18px] border-surface-sunken" />
        <div className="mt-10 h-12 w-40 animate-pulse rounded-2xl bg-surface-sunken" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="mx-auto flex min-h-[calc(100dvh-6rem)] max-w-2xl flex-col items-center px-4 py-10 md:min-h-dvh md:justify-center">
        <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-ink-soft">
          Focus
        </p>
        <h1 className="mt-1 font-display text-3xl font-bold tracking-tight">
          {title}
        </h1>
        <p className="tnum mt-1 text-sm font-medium text-ink-soft">
          {durationMin} min session
        </p>
        <div className="mt-10 opacity-80">
          <FocusRing
            remainingSec={durationMin * 60}
            targetMin={durationMin}
            emoji={emoji}
          />
        </div>

        <div
          className="mt-8 flex items-center gap-1.5 rounded-full border border-border bg-surface p-1 shadow-card"
          role="group"
          aria-label="Session length"
        >
          {[15, 25, 45, 60].map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={durationMin === m}
              onClick={() => setDurationMin(m)}
              className={`tnum rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-iris focus-visible:outline-none ${
                durationMin === m
                  ? "bg-iris-soft text-iris"
                  : "text-ink-soft hover:text-ink"
              }`}
            >
              {m} min
            </button>
          ))}
        </div>

        {error && (
          <p role="alert" className="mt-4 text-[13px] font-semibold text-danger">
            {error}
          </p>
        )}
        <button
          type="button"
          onClick={() => void start()}
          className="mt-8 inline-flex items-center gap-2 rounded-2xl bg-iris px-8 py-3.5 text-[15px] font-semibold text-ink-inverse shadow-float transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-iris focus-visible:outline-none"
        >
          <Play size={17} fill="currentColor" />
          Start focus
        </button>
        {activityId && (
          <p className="mt-3 text-[12px] text-ink-faint">
            Linked activity · {activityId.slice(0, 8)}…
          </p>
        )}

        <div className="mt-8 flex w-full max-w-sm items-center gap-2 rounded-2xl border border-border bg-surface p-2 shadow-card focus-within:ring-2 focus-within:ring-iris">
          <input
            value={emoji}
            onChange={(e) => setEmoji(e.target.value)}
            aria-label="Session emoji"
            className="w-12 shrink-0 rounded-xl bg-surface-sunken py-2 text-center text-lg outline-none"
          />
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            aria-label="Session title"
            placeholder="What are you focusing on?"
            className="w-full bg-transparent px-1 text-[15px] font-medium outline-none placeholder:text-ink-faint"
          />
        </div>
      </div>
    );
  }

  const isPaused = session.state === "paused";

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-6rem)] max-w-2xl flex-col items-center px-4 py-10 md:min-h-dvh md:justify-center">
      <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-ink-soft">
        {isPaused ? "Paused" : "Now focusing"}
      </p>
      <h1 className="mt-1 font-display text-3xl font-bold tracking-tight">{title}</h1>
      <p className="tnum mt-1 text-sm font-medium text-ink-soft">
        {session.targetDurationMin} min target
      </p>

      <div className="mt-10">
        <FocusRing
          remainingSec={remainingSec}
          targetMin={session.targetDurationMin}
          emoji={emoji}
        />
      </div>

      {steps.length > 0 && (
        <ul className="mt-6 w-full max-w-sm space-y-1.5 rounded-2xl border border-border bg-surface p-4 shadow-card">
          <li className="mb-1 text-[11px] font-bold uppercase tracking-wide text-ink-faint">
            Steps
          </li>
          {steps.map((s, i) => (
            <li key={i} className="text-[14px] font-medium text-ink-soft">
              ○ {s}
            </li>
          ))}
        </ul>
      )}

      {error && (
        <p role="alert" className="mt-4 text-[13px] font-semibold text-danger">
          {error}
        </p>
      )}

      <div className="mt-10 flex items-center gap-4">
        <div className="flex flex-col items-center gap-1">
          <button
            type="button"
            aria-label="Extend 5 minutes"
            onClick={() => void patch({ action: "extend", addMinutes: 5 })}
            className="grid size-14 place-items-center rounded-full border border-border bg-surface text-ink-soft shadow-card transition-colors hover:text-ink focus-visible:ring-2 focus-visible:ring-iris focus-visible:outline-none"
          >
            <Plus size={22} />
          </button>
          <span className="text-[11px] font-semibold text-ink-faint">+5</span>
        </div>
        <button
          type="button"
          aria-label={isPaused ? "Resume" : "Pause"}
          onClick={() =>
            void patch({
              action: "transition",
              state: isPaused ? "running" : "paused",
            })
          }
          className="grid size-20 place-items-center rounded-full bg-iris text-ink-inverse shadow-float transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-iris focus-visible:outline-none"
        >
          {isPaused ? (
            <Play size={30} fill="currentColor" />
          ) : (
            <Pause size={30} fill="currentColor" />
          )}
        </button>
        <div className="flex flex-col items-center gap-1">
          <button
            type="button"
            aria-label="Skip session"
            onClick={() => void patch({ action: "transition", state: "skipped" })}
            className="grid size-14 place-items-center rounded-full border border-border bg-surface text-ink-soft shadow-card transition-colors hover:text-ink focus-visible:ring-2 focus-visible:ring-iris focus-visible:outline-none"
          >
            <SkipForward size={22} />
          </button>
          <span className="text-[11px] font-semibold text-ink-faint">Skip</span>
        </div>
      </div>

      <button
        type="button"
        onClick={() => void patch({ action: "transition", state: "completed" })}
        className="mt-8 inline-flex items-center gap-2 rounded-xl bg-success-soft px-5 py-2.5 text-[14px] font-semibold text-success focus-visible:ring-2 focus-visible:ring-iris focus-visible:outline-none"
      >
        <Check size={16} strokeWidth={3} />
        Complete
      </button>

      <div className="mt-6 flex gap-2">
        {[1, 5, 10].map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => void patch({ action: "extend", addMinutes: m })}
            className="rounded-full border border-border bg-surface px-3 py-1 text-[12px] font-semibold text-ink-soft hover:text-ink"
          >
            +{m} min
          </button>
        ))}
      </div>
    </div>
  );
}
