"use client";

/**
 * Weekly Intentions (F7) — 1–3 gentle aims for the week, streak-free.
 *
 * Not tasks, not a streak — just "what would make this week feel good?" You set
 * up to three, tick them when they happen, and they reset each week without
 * guilt. Persisted in settings.notificationPrefs.intentions so it syncs to iOS.
 */

import { useEffect, useState } from "react";
import { Check, Target } from "lucide-react";

type Intention = { text: string; done: boolean };
type Stored = { week: string; items: Intention[] };

export function WeeklyIntentions({ weekStart }: { weekStart: string }) {
  const [items, setItems] = useState<Intention[]>([]);
  const [draft, setDraft] = useState("");
  const [revision, setRevision] = useState<number | null>(null);
  const [prefs, setPrefs] = useState<Record<string, unknown>>({});
  const [loaded, setLoaded] = useState(false);
  const [authed, setAuthed] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/v1/settings")
      .then((r) => {
        if (r.status === 401) {
          setAuthed(false);
          return null;
        }
        return r.ok ? r.json() : null;
      })
      .then((s) => {
        if (cancelled || !s) return;
        setRevision(s.revision ?? null);
        const np = (s.notificationPrefs ?? {}) as Record<string, unknown>;
        setPrefs(np);
        const stored = np.intentions as Stored | undefined;
        if (stored && stored.week === weekStart && Array.isArray(stored.items)) {
          setItems(stored.items.slice(0, 3));
        }
        setLoaded(true);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [weekStart]);

  async function persist(next: Intention[]) {
    setItems(next);
    if (revision == null) return;
    const nextPrefs = { ...prefs, intentions: { week: weekStart, items: next } };
    setPrefs(nextPrefs);
    try {
      const res = await fetch("/api/v1/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "If-Match": String(revision) },
        body: JSON.stringify({ notificationPrefs: nextPrefs }),
      });
      if (res.ok) {
        const s = await res.json();
        if (s?.revision != null) setRevision(s.revision);
      }
    } catch {
      /* offline — kept locally for this view */
    }
  }

  function add() {
    const t = draft.trim();
    if (!t || items.length >= 3) return;
    setDraft("");
    void persist([...items, { text: t, done: false }]);
  }

  function toggle(i: number) {
    void persist(items.map((it, k) => (k === i ? { ...it, done: !it.done } : it)));
  }

  function remove(i: number) {
    void persist(items.filter((_, k) => k !== i));
  }

  if (!authed || !loaded) return null;

  return (
    <section className="mb-6 rounded-3xl border border-border bg-surface p-5 shadow-card">
      <div className="flex items-center gap-2">
        <Target size={17} className="text-iris" />
        <h2 className="font-display text-base font-bold">This week, I&apos;d love to…</h2>
      </div>
      <p className="mt-0.5 text-[12.5px] text-ink-soft">
        Up to three gentle aims · no streak, resets Monday
      </p>

      <ul className="mt-4 space-y-2">
        {items.map((it, i) => (
          <li key={i} className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => toggle(i)}
              aria-label={it.done ? "Mark not done" : "Mark done"}
              className={`grid size-6 shrink-0 place-items-center rounded-lg border transition-colors focus-visible:ring-2 focus-visible:ring-iris focus-visible:outline-none ${
                it.done
                  ? "border-iris bg-iris text-ink-inverse"
                  : "border-border-strong bg-surface hover:border-iris"
              }`}
            >
              {it.done && <Check size={14} strokeWidth={3} />}
            </button>
            <span
              className={`flex-1 text-[14px] ${
                it.done ? "text-ink-faint line-through" : "text-ink"
              }`}
            >
              {it.text}
            </span>
            <button
              type="button"
              onClick={() => remove(i)}
              aria-label="Remove aim"
              className="text-[12px] font-semibold text-ink-faint hover:text-danger"
            >
              ✕
            </button>
          </li>
        ))}
      </ul>

      {items.length < 3 && (
        <div className="mt-3 flex items-center gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") add();
            }}
            placeholder={items.length === 0 ? "e.g. move my body 3 times" : "add another…"}
            maxLength={80}
            className="flex-1 rounded-xl border border-border bg-surface-raised px-3 py-2 text-[14px] outline-none focus:ring-2 focus:ring-iris"
          />
          <button
            type="button"
            onClick={add}
            disabled={!draft.trim()}
            className="rounded-xl bg-iris px-3.5 py-2 text-[13px] font-semibold text-ink-inverse disabled:opacity-50"
          >
            Add
          </button>
        </div>
      )}
    </section>
  );
}
