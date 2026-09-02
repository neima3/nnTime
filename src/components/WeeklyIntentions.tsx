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
import {
  addIntention,
  MAX_INTENTIONS,
  MAX_INTENTION_LENGTH,
  parseIntentions,
  removeIntention,
  toggleIntention,
  writeIntentions,
  type Intention,
} from "@/lib/intentions";
import { toast } from "./Toast";

export function WeeklyIntentions({ weekStart }: { weekStart: string }) {
  const [items, setItems] = useState<Intention[]>([]);
  const [draft, setDraft] = useState("");
  const [revision, setRevision] = useState<number | null>(null);
  const [prefs, setPrefs] = useState<Record<string, unknown>>({});
  const [loaded, setLoaded] = useState(false);
  const [authed, setAuthed] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let signedOut = false;
    fetch("/api/v1/settings")
      .then((r) => {
        if (r.status === 401) {
          setAuthed(false);
          signedOut = true;
          return null;
        }
        return r.ok ? r.json() : null;
      })
      .then((s) => {
        if (cancelled) return;
        if (!s) {
          // 401 already renders the signed-out null; any other empty response
          // is a load failure — show it instead of staying invisible forever.
          if (!signedOut) {
            setLoaded(true);
            setLoadFailed(true);
          }
          return;
        }
        setRevision(s.revision ?? null);
        const np = (s.notificationPrefs ?? {}) as Record<string, unknown>;
        setPrefs(np);
        setItems(parseIntentions(np, weekStart));
        setLoaded(true);
      })
      .catch(() => {
        if (!cancelled) {
          setLoaded(true);
          setLoadFailed(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [weekStart, retryKey]);

  async function persist(next: Intention[]) {
    setItems(next);
    if (revision == null) return;
    const nextPrefs = writeIntentions(prefs, weekStart, next);
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
      } else {
        toast("Couldn't save it just now — kept on this device");
      }
    } catch {
      // Offline — kept locally for this view, so say so instead of failing silently.
      toast("Couldn't save it just now — kept on this device");
    }
  }

  function add() {
    const next = addIntention(items, draft);
    setDraft("");
    // Same reference = blank, duplicate, or at the cap. Nothing to save.
    if (next === items) return;
    void persist(next);
  }

  function toggle(i: number) {
    void persist(toggleIntention(items, i));
  }

  function remove(i: number) {
    void persist(removeIntention(items, i));
  }

  function retryLoad() {
    setLoadFailed(false);
    setRetryKey((k) => k + 1);
  }

  if (!authed || !loaded) return null;

  if (loadFailed) {
    return (
      <section className="mb-6 rounded-3xl border border-dashed border-border bg-surface/60 p-5 text-center">
        <p className="text-[14px] font-semibold text-ink-soft">
          Couldn&apos;t load your intentions — they&apos;re safe on the server.
        </p>
        <button
          type="button"
          onClick={retryLoad}
          className="mt-3 inline-flex min-h-11 items-center rounded-xl bg-iris-soft px-4 py-2 text-[13px] font-semibold text-iris focus-visible:ring-2 focus-visible:ring-iris focus-visible:outline-none"
        >
          Retry
        </button>
      </section>
    );
  }

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

      {items.length < MAX_INTENTIONS && (
        <div className="mt-3 flex items-center gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") add();
            }}
            placeholder={items.length === 0 ? "e.g. move my body 3 times" : "add another…"}
            maxLength={MAX_INTENTION_LENGTH}
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
