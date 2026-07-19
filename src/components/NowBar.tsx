"use client";

/**
 * Ambient "now" anchor (10× ADHD Phase 1 — time blindness).
 *
 * One provider fetches today's resolved day and derives what's happening right
 * now; a sidebar card (desktop) and a strip above the tab bar (mobile) render
 * it on every app route. Tapping either goes to Today, which auto-scrolls to
 * the now-line. Hidden when signed out, when the day has nothing left, and on
 * /app/focus (the ring owns "now" there).
 */
import Link from "next/link";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { clientToday } from "@/lib/client-date";
import { dateToMinutesFromMidnight } from "@/lib/adapters";
import { fmt } from "@/lib/mock";
import { toast } from "./Toast";

interface DayActivity {
  title: string;
  emoji: string;
  startMin: number;
  endMin: number;
  done: boolean;
  /** Remaining (not-done) checklist labels, if any. */
  nextSteps: string[];
}

interface NowInfo {
  nowMin: number;
  current: DayActivity | null;
  next: DayActivity | null;
}

const NowContext = createContext<NowInfo | null>(null);

const DAY_CHANGED_EVENT = "kairo:day-changed";

/** Tell the NowBar (and anything else watching) that today's plan mutated. */
export function notifyDayChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(DAY_CHANGED_EVENT));
}

export function useNowInfo() {
  return useContext(NowContext);
}

export function NowProvider({ children }: { children: React.ReactNode }) {
  const [activities, setActivities] = useState<DayActivity[] | null>(null);
  const [zone, setZone] = useState<string | undefined>(undefined);
  const [nowMin, setNowMin] = useState<number | null>(null);

  // Load today's plan; refresh every 5 minutes and on tab re-focus.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/v1/day/${clientToday()}`);
        if (!res.ok) {
          if (!cancelled) setActivities(null);
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        const z: string = data.zone;
        interface WireActivity {
          title: string;
          emoji: string | null;
          dtstartLocal: string;
          durationMin: number;
          status: string;
          checklistTemplate?: { label: string; done: boolean }[] | null;
        }
        const acts: DayActivity[] = (data.activities as WireActivity[]).map(
          (a) => {
            const startMin = dateToMinutesFromMidnight(
              new Date(a.dtstartLocal),
              z,
            );
            return {
              title: a.title,
              emoji: a.emoji ?? "📋",
              startMin,
              endMin: startMin + a.durationMin,
              done: a.status !== "pending",
              nextSteps: (a.checklistTemplate ?? [])
                .filter((c) => !c.done)
                .map((c) => c.label),
            };
          },
        );
        acts.sort((a, b) => a.startMin - b.startMin);
        setZone(z);
        setActivities(acts);
        setNowMin(dateToMinutesFromMidnight(new Date(), z));
      } catch {
        /* offline / signed out */
      }
    }
    void load();
    const interval = setInterval(() => void load(), 5 * 60 * 1000);
    const onVisible = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVisible);
    const onDayChanged = () => void load();
    window.addEventListener(DAY_CHANGED_EVENT, onDayChanged);
    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener(DAY_CHANGED_EVENT, onDayChanged);
    };
  }, []);

  // Tick the clock every 30 s.
  useEffect(() => {
    if (!zone) return;
    const tick = setInterval(
      () => setNowMin(dateToMinutesFromMidnight(new Date(), zone)),
      30_000,
    );
    return () => clearInterval(tick);
  }, [zone]);

  // --- Transition warnings (Phase 7) -------------------------------------
  // Opt-in via Settings (notificationPrefs.transitionWarnings). While the app
  // is open: a nudge when an activity starts, and 5 min before it ends.
  // In-app toast always; system notification only when granted and not in
  // reduced-stimulation mode. Never fires when the toggle is off.
  const [warningsEnabled, setWarningsEnabled] = useState(false);
  const prevNowRef = useRef<number | null>(null);
  const firedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    fetch("/api/v1/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => {
        if (cancelled || !s) return;
        setWarningsEnabled(
          Boolean(
            (s.notificationPrefs as Record<string, unknown> | null)
              ?.transitionWarnings,
          ),
        );
      })
      .catch(() => {});
    const onToggle = (e: Event) => {
      setWarningsEnabled(
        Boolean((e as CustomEvent<{ enabled: boolean }>).detail?.enabled),
      );
    };
    window.addEventListener("kairo:transition-warnings", onToggle);
    return () => {
      cancelled = true;
      window.removeEventListener("kairo:transition-warnings", onToggle);
    };
  }, []);

  useEffect(() => {
    if (!activities || nowMin == null) return;
    const prev = prevNowRef.current;
    prevNowRef.current = nowMin;
    if (!warningsEnabled) return;
    if (prev == null || nowMin < prev) return; // first tick / day rollover

    const fire = (key: string, message: string) => {
      if (firedRef.current.has(key)) return;
      firedRef.current.add(key);
      toast(message, { durationMs: 8000, actionLabel: "OK", onAction: () => {} });
      const reducedStim = document.documentElement.classList.contains(
        "reduced-stimulation",
      );
      if (
        !reducedStim &&
        typeof Notification !== "undefined" &&
        Notification.permission === "granted"
      ) {
        try {
          new Notification("Kairo", {
            body: message,
            icon: "/icon-192.png",
            tag: key,
          });
        } catch {}
      }
    };

    for (const a of activities) {
      if (a.done) continue;
      if (prev < a.startMin && a.startMin <= nowMin) {
        fire(`start:${a.title}:${a.startMin}`, `Starting now: ${a.emoji} ${a.title}`);
      }
      const wrapAt = a.endMin - 5;
      if (a.endMin - a.startMin > 10 && prev < wrapAt && wrapAt <= nowMin) {
        fire(
          `wrap:${a.title}:${a.endMin}`,
          `${a.emoji} ${a.title} wraps up in 5 minutes`,
        );
      }
    }
  }, [nowMin, activities, warningsEnabled]);

  let value: NowInfo | null = null;
  if (activities && nowMin != null) {
    const current =
      activities.find(
        (a) => !a.done && a.startMin <= nowMin && nowMin < a.endMin,
      ) ?? null;
    const next =
      activities.find((a) => !a.done && a.startMin > nowMin) ?? null;
    value = { nowMin, current, next };
  }

  return <NowContext.Provider value={value}>{children}</NowContext.Provider>;
}

function nowLine(info: NowInfo): {
  label: string;
  title: string;
  emoji: string;
  meta: string;
} | null {
  if (info.current) {
    const left = info.current.endMin - info.nowMin;
    return {
      label: "Now",
      title: info.current.title,
      emoji: info.current.emoji,
      meta: `${left} min left`,
    };
  }
  if (info.next) {
    const inMin = info.next.startMin - info.nowMin;
    return {
      label: `Free until ${fmt(info.next.startMin)}`,
      title: info.next.title,
      emoji: info.next.emoji,
      meta: inMin <= 90 ? `in ${inMin} min` : `at ${fmt(info.next.startMin)}`,
    };
  }
  return null;
}

/** Desktop sidebar card — sits under the nav list. */
export function NowCard({ active }: { active: string }) {
  const info = useNowInfo();
  if (!info || active === "focus") return null;
  const line = nowLine(info);
  if (!line) return null;
  const isNow = line.label === "Now";
  return (
    <Link
      href="/app/today"
      className={`group mt-4 block rounded-2xl border p-3.5 transition-colors focus-visible:ring-2 focus-visible:ring-iris focus-visible:outline-none ${
        isNow
          ? "border-now/30 bg-surface hover:border-now/50"
          : "border-border bg-surface-sunken hover:bg-surface"
      }`}
      aria-label={`${line.label}: ${line.title}, ${line.meta}. Go to Today.`}
    >
      <p
        className={`flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.1em] ${
          isNow ? "text-now" : "text-ink-faint"
        }`}
      >
        {isNow && (
          <span className="relative flex size-2" aria-hidden>
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-now opacity-60 motion-reduce:hidden" />
            <span className="relative inline-flex size-2 rounded-full bg-now" />
          </span>
        )}
        <span className="flex-1">{line.label}</span>
        <button
          type="button"
          aria-label="Open one-thing view (O)"
          title="One thing (O)"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            window.dispatchEvent(new Event("kairo:one-thing"));
          }}
          className="rounded-md p-0.5 text-ink-faint opacity-0 transition-opacity hover:text-ink focus-visible:opacity-100 group-hover:opacity-100"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
            <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
          </svg>
        </button>
      </p>
      <p className="mt-1 truncate text-[14px] font-semibold text-ink">
        <span aria-hidden>{line.emoji}</span> {line.title}
      </p>
      <p className="tnum mt-0.5 text-[12px] font-medium text-ink-soft">
        {line.meta}
      </p>
    </Link>
  );
}

/** Mobile strip — floats just above the tab bar. */
export function NowStrip({ active }: { active: string }) {
  const info = useNowInfo();
  if (!info || active === "focus" || active === "today") return null;
  const line = nowLine(info);
  if (!line) return null;
  const isNow = line.label === "Now";
  return (
    <Link
      href="/app/today"
      className="fixed inset-x-3 bottom-[calc(3.75rem+env(safe-area-inset-bottom))] z-40 flex items-center gap-2.5 rounded-2xl border border-border bg-surface/95 px-3.5 py-2.5 shadow-float backdrop-blur md:hidden"
      aria-label={`${line.label}: ${line.title}, ${line.meta}. Go to Today.`}
    >
      {isNow ? (
        <span className="relative flex size-2 shrink-0" aria-hidden>
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-now opacity-60 motion-reduce:hidden" />
          <span className="relative inline-flex size-2 rounded-full bg-now" />
        </span>
      ) : (
        <span className="size-2 shrink-0 rounded-full bg-ink-faint/50" aria-hidden />
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-semibold text-ink">
          <span aria-hidden>{line.emoji}</span> {line.title}
        </span>
        <span className="tnum block text-[11px] font-medium text-ink-soft">
          {isNow ? line.meta : `${line.label} · ${line.meta}`}
        </span>
      </span>
      <span className="tnum shrink-0 text-[11px] font-bold uppercase tracking-wide text-iris">
        Today →
      </span>
    </Link>
  );
}
