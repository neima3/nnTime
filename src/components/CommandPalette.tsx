"use client";

/**
 * Command palette (wave 4) — ⌘K / Ctrl+K. Fuzzy jump to any screen or
 * action without hunting through menus: for ADHD brains the shortest path
 * from intent to action wins. Client-only, keyboard-first, focus-trapped.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart3,
  CalendarCheck,
  CalendarDays,
  CalendarRange,
  Gamepad2,
  Inbox,
  LayoutTemplate,
  Maximize2,
  PenLine,
  Plus,
  Repeat,
  Search,
  Settings,
  Sparkles,
  Timer,
} from "lucide-react";
import { clientToday } from "@/lib/client-date";

interface Command {
  id: string;
  label: string;
  hint?: string;
  keywords: string;
  icon: React.ComponentType<{ size?: number }>;
  run: (router: ReturnType<typeof useRouter>) => void;
}

const COMMANDS: Command[] = [
  { id: "new", label: "New activity", hint: "n", keywords: "create add block event", icon: Plus, run: (r) => r.push(`/app/editor?date=${clientToday()}&start=${9 * 60}`) },
  { id: "capture", label: "Quick capture a thought", hint: "c", keywords: "brain dump inbox note idea", icon: PenLine, run: () => window.dispatchEvent(new Event("kairo:quick-capture")) },
  { id: "one-thing", label: "One thing — just show me now", hint: "o", keywords: "focus current single overwhelm", icon: Maximize2, run: () => window.dispatchEvent(new Event("kairo:one-thing")) },
  { id: "today", label: "Go to Today", hint: "t", keywords: "timeline day now", icon: CalendarDays, run: (r) => r.push("/app/today") },
  { id: "inbox", label: "Go to Inbox", hint: "i", keywords: "tasks brain dump", icon: Inbox, run: (r) => r.push("/app/inbox") },
  { id: "week", label: "Go to Week", hint: "w", keywords: "calendar overview", icon: CalendarRange, run: (r) => r.push("/app/week") },
  { id: "focus", label: "Start a focus session", hint: "f", keywords: "timer pomodoro deep work", icon: Timer, run: (r) => r.push("/app/focus") },
  { id: "play", label: "Take a brain break", hint: "g", keywords: "games play arcade time feel quick tap match breath grammar spelling", icon: Gamepad2, run: (r) => r.push("/app/play") },
  { id: "review", label: "Review my day", keywords: "evening close leftover done", icon: CalendarCheck, run: (r) => r.push("/app/review") },
  { id: "routines", label: "Go to Routines", keywords: "sequences player steps", icon: Repeat, run: (r) => r.push("/app/routines") },
  { id: "planner", label: "Plan my day with AI", keywords: "ai co-planner break down", icon: Sparkles, run: (r) => r.push("/app/planner") },
  { id: "templates", label: "Browse templates", keywords: "starter ready made", icon: LayoutTemplate, run: (r) => r.push("/app/templates") },
  { id: "stats", label: "Go to Stats", keywords: "insights numbers streak focus hours", icon: BarChart3, run: (r) => r.push("/app/stats") },
  { id: "settings", label: "Go to Settings", hint: "s", keywords: "theme timezone notifications account", icon: Settings, run: (r) => r.push("/app/settings") },
];

/** Simple subsequence fuzzy score; lower = better, null = no match. */
export function fuzzyScore(query: string, target: string): number | null {
  const q = query.toLowerCase().trim();
  if (!q) return 0;
  const t = target.toLowerCase();
  let ti = 0;
  let gaps = 0;
  for (const ch of q) {
    const found = t.indexOf(ch, ti);
    if (found === -1) return null;
    gaps += found - ti;
    ti = found + 1;
  }
  return gaps + (t.startsWith(q) ? -100 : 0);
}

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
        setQuery("");
        setIndex(0);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const results = useMemo(() => {
    return COMMANDS.map((c) => ({
      c,
      score: fuzzyScore(query, `${c.label} ${c.keywords}`),
    }))
      .filter((x): x is { c: Command; score: number } => x.score != null)
      .sort((a, b) => a.score - b.score)
      .map((x) => x.c);
  }, [query]);

  const run = (c: Command) => {
    setOpen(false);
    setQuery("");
    c.run(router);
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center bg-ink/25 px-4 pt-[16dvh] backdrop-blur-[2px]"
      onClick={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="rise-in w-full max-w-lg overflow-hidden rounded-3xl border border-border bg-surface shadow-float"
      >
        <div className="flex items-center gap-2.5 border-b border-border px-4">
          <Search size={17} className="shrink-0 text-ink-faint" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIndex(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setIndex((i) => Math.min(i + 1, results.length - 1));
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setIndex((i) => Math.max(i - 1, 0));
              }
              if (e.key === "Enter" && results[index]) {
                e.preventDefault();
                run(results[index]);
              }
            }}
            placeholder="Jump anywhere, do anything…"
            className="w-full bg-transparent py-3.5 text-[15px] outline-none placeholder:text-ink-faint"
          />
          <kbd className="shrink-0 rounded-md bg-surface-sunken px-1.5 py-0.5 font-mono text-[11px] font-bold text-ink-faint">
            esc
          </kbd>
        </div>
        <ul className="max-h-[46dvh] overflow-y-auto p-2" role="listbox">
          {results.length === 0 && (
            <li className="px-3 py-6 text-center text-[13.5px] text-ink-soft">
              Nothing matches — try fewer letters.
            </li>
          )}
          {results.map((c, i) => {
            const Icon = c.icon;
            return (
              <li key={c.id} role="option" aria-selected={i === index}>
                <button
                  type="button"
                  onClick={() => run(c)}
                  onMouseEnter={() => setIndex(i)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[14px] font-medium transition-colors ${
                    i === index
                      ? "bg-iris-soft text-iris"
                      : "text-ink hover:bg-surface-sunken"
                  }`}
                >
                  <Icon size={17} />
                  <span className="flex-1">{c.label}</span>
                  {c.hint && (
                    <kbd className="rounded-md bg-surface-sunken px-1.5 py-0.5 font-mono text-[11px] font-bold text-ink-faint">
                      {c.hint}
                    </kbd>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
