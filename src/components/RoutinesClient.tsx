"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Pause, Play, PlayCircle, Plus, Trash2 } from "lucide-react";
import { clientToday } from "@/lib/client-date";
import { toast } from "./Toast";
import { RoutinePlayer } from "./RoutinePlayer";

export type RoutineView = {
  id: string;
  title: string;
  emoji: string;
  stepCount: number;
  totalMin: number;
  revision: number;
  paused: boolean;
  scheduleId?: string;
  scheduleRevision?: number;
  rruleLabel: string;
};

/* Deterministic pastel per routine — id-hashed so cards vary but stay stable. */
const TILE_FILLS = [
  "bg-cat-peach",
  "bg-cat-butter",
  "bg-cat-mint",
  "bg-cat-sky",
  "bg-cat-lilac",
  "bg-cat-rose",
];

function tileFill(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return TILE_FILLS[h % TILE_FILLS.length]!;
}

export function RoutinesClient({
  initial,
  authed,
}: {
  initial: RoutineView[];
  authed: boolean;
}) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [emoji, setEmoji] = useState("🔁");
  const [stepsText, setStepsText] = useState("");
  const [busy, setBusy] = useState(false);
  const [playing, setPlaying] = useState<RoutineView | null>(null);

  const create = useCallback(async () => {
    if (!authed) {
      toast("Sign in to save routines");
      return;
    }
    const t = title.trim();
    if (!t) return;
    setBusy(true);
    const steps = stepsText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => ({ title: s, durationMin: 10 }));
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const res = await fetch("/api/v1/routines", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: t,
        emoji,
        steps,
        schedule: { tz, rrule: "FREQ=DAILY", paused: false },
      }),
    });
    setBusy(false);
    if (!res.ok) {
      toast("Couldn't create it — try again");
      return;
    }
    toast("Routine created");
    setOpen(false);
    setTitle("");
    setStepsText("");
    router.refresh();
  }, [authed, title, emoji, stepsText, router]);

  const togglePause = useCallback(
    async (r: RoutineView) => {
      if (!r.scheduleId || r.scheduleRevision == null) return;
      const res = await fetch(
        `/api/v1/routines/${r.id}/schedules/${r.scheduleId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "If-Match": String(r.scheduleRevision),
          },
          body: JSON.stringify({ paused: !r.paused }),
        },
      );
      if (!res.ok) {
        toast("Couldn't update the schedule — try again");
        return;
      }
      setItems((prev) =>
        prev.map((x) =>
          x.id === r.id
            ? {
                ...x,
                paused: !r.paused,
                scheduleRevision: (x.scheduleRevision ?? 1) + 1,
              }
            : x,
        ),
      );
      toast(r.paused ? "Schedule resumed" : "Schedule paused");
    },
    [],
  );

  const remove = useCallback(
    async (r: RoutineView) => {
      if (!confirm(`Delete “${r.title}”?`)) return;
      const res = await fetch(`/api/v1/routines/${r.id}`, {
        method: "DELETE",
        headers: { "If-Match": String(r.revision) },
      });
      if (!res.ok && res.status !== 204) {
        toast("Couldn't delete it — try again");
        return;
      }
      setItems((prev) => prev.filter((x) => x.id !== r.id));
      toast("Deleted");
      router.refresh();
    },
    [router],
  );

  const scheduleToday = useCallback(
    (r: RoutineView) => {
      const params = new URLSearchParams({
        title: r.title,
        date: clientToday(),
        start: String(8 * 60),
      });
      router.push(`/app/editor?${params}`);
    },
    [router],
  );

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 rounded-2xl bg-iris px-4 py-2.5 text-sm font-semibold text-ink-inverse shadow-card hover:bg-iris-deep focus-visible:ring-2 focus-visible:ring-iris focus-visible:outline-none"
        >
          <Plus size={17} strokeWidth={2.5} />
          New routine
        </button>
      </div>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="new-routine-title"
          className="mb-6 rounded-3xl border border-border bg-surface p-5 shadow-float"
        >
          <h2 id="new-routine-title" className="font-display text-lg font-bold">
            New routine
          </h2>
          <div className="mt-4 flex gap-3">
            <input
              value={emoji}
              onChange={(e) => setEmoji(e.target.value)}
              className="w-14 rounded-xl border border-border bg-surface-raised px-2 py-2 text-center text-xl"
              aria-label="Emoji"
            />
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Morning reset"
              className="flex-1 rounded-xl border border-border bg-surface-raised px-3 py-2 text-[15px] font-semibold outline-none focus:ring-2 focus:ring-iris"
            />
          </div>
          <textarea
            value={stepsText}
            onChange={(e) => setStepsText(e.target.value)}
            placeholder={"One step per line\nWater + meds\nStretch\nMake bed"}
            rows={4}
            className="mt-3 w-full rounded-xl border border-border bg-surface-raised px-3 py-2 text-[14px] outline-none focus:ring-2 focus:ring-iris"
          />
          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-xl px-4 py-2 text-[13px] font-semibold text-ink-soft"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={busy || !title.trim()}
              onClick={() => void create()}
              className="rounded-xl bg-iris px-4 py-2 text-[13px] font-semibold text-ink-inverse disabled:opacity-50"
            >
              {busy ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((r) => (
          <article
            key={r.id}
            className="rounded-3xl border border-border bg-surface p-5 shadow-card"
          >
            <div className="flex items-start gap-3">
              <span className={`grid size-12 place-items-center rounded-2xl text-xl ${tileFill(r.id)}`}>
                {r.emoji}
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="font-display text-lg font-bold">{r.title}</h3>
                <p className="tnum text-[12px] font-medium text-ink-soft">
                  {r.stepCount} steps · {r.totalMin || "—"} min · {r.rruleLabel}
                  {r.paused ? " · paused" : ""}
                </p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setPlaying(r)}
                disabled={r.stepCount === 0}
                className="inline-flex items-center gap-1 rounded-xl bg-iris px-3 py-1.5 text-[12px] font-semibold text-ink-inverse transition-colors hover:bg-iris-deep disabled:opacity-40"
              >
                <PlayCircle size={13} />
                Play
              </button>
              <button
                type="button"
                onClick={() => scheduleToday(r)}
                className="inline-flex items-center gap-1 rounded-xl bg-iris-soft px-3 py-1.5 text-[12px] font-semibold text-iris-deep"
              >
                <Play size={13} />
                Use today
              </button>
              {r.scheduleId && (
                <button
                  type="button"
                  onClick={() => void togglePause(r)}
                  className="inline-flex items-center gap-1 rounded-xl border border-border px-3 py-1.5 text-[12px] font-semibold text-ink-soft"
                >
                  {r.paused ? <Play size={13} /> : <Pause size={13} />}
                  {r.paused ? "Resume" : "Pause"}
                </button>
              )}
              {authed && (
                <button
                  type="button"
                  onClick={() => void remove(r)}
                  className="inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-[12px] font-semibold text-danger"
                >
                  <Trash2 size={13} />
                  Delete
                </button>
              )}
            </div>
          </article>
        ))}
        {items.length === 0 && (
          <div className="rounded-3xl border border-dashed border-border px-6 py-12 text-center sm:col-span-2">
            <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-iris-ghost text-xl" aria-hidden>
              🔁
            </span>
            <p className="mt-3 text-[15px] font-semibold">No routines yet</p>
            <p className="mx-auto mt-1 max-w-xs text-[13px] leading-relaxed text-ink-soft">
              A routine is a sequence you can drop into any day — mornings, wind-downs, gym blocks.
            </p>
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-iris px-4 py-2 text-[13px] font-semibold text-ink-inverse shadow-card transition-colors hover:bg-iris-deep focus-visible:ring-2 focus-visible:ring-iris focus-visible:outline-none"
            >
              + Build your first routine
            </button>
          </div>
        )}
      </div>

      {playing && (
        <RoutinePlayer
          routineId={playing.id}
          title={playing.title}
          emoji={playing.emoji}
          onExit={() => setPlaying(null)}
        />
      )}
    </>
  );
}
