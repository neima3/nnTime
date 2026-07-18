"use client";

/**
 * Review Today actions — complete / let-go / move tomorrow (10× Phase 10).
 */

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, SkipForward } from "lucide-react";
import { catClasses, type CategoryId } from "@/lib/mock";
import { localMinutesToInstant } from "@/lib/adapters";

export type ReviewItem = {
  id: string;
  title: string;
  emoji: string;
  category: CategoryId;
  time: string;
  revision: number;
  occurrenceKey: string;
  startMin: number;
  durationMin: number;
  checklist?: string;
};

export function ReviewClient({
  items: initial,
  date,
  zone,
  authed,
}: {
  items: ReviewItem[];
  date: string;
  zone: string;
  authed: boolean;
}) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [index] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const current = items[index];
  const remaining = items.length - index;

  const act = useCallback(
    async (kind: "complete" | "skip" | "tomorrow") => {
      if (!current || !authed) return;
      setBusy(true);
      setError(null);
      try {
        if (kind === "complete" || kind === "skip") {
          const res = await fetch(`/api/v1/activities/${current.id}`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              "If-Match": String(current.revision),
            },
            body: JSON.stringify({
              editScope: "this",
              occurrenceKey: current.occurrenceKey,
              status: kind === "complete" ? "completed" : "skipped",
              completedAt:
                kind === "complete" ? new Date().toISOString() : null,
            }),
          });
          if (!res.ok) {
            setError("Could not update activity.");
            setBusy(false);
            return;
          }
        } else {
          // Move this occurrence only (occurrence override), not the whole series.
          const [y, m, d] = date.split("-").map(Number);
          const next = new Date(Date.UTC(y!, m! - 1, d! + 1));
          const nextDate = next.toISOString().slice(0, 10);
          const startAt = localMinutesToInstant(
            nextDate,
            current.startMin,
            zone,
          );
          const res = await fetch(`/api/v1/activities/${current.id}`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              "If-Match": String(current.revision),
            },
            body: JSON.stringify({
              editScope: "this",
              occurrenceKey: current.occurrenceKey,
              startAt,
            }),
          });
          if (!res.ok) {
            setError("Could not reschedule.");
            setBusy(false);
            return;
          }
        }
        setItems((prev) => prev.filter((x) => x.id !== current.id));
        // index stays; next item slides into place
        setBusy(false);
        router.refresh();
      } catch {
        setError("Network error.");
        setBusy(false);
      }
    },
    [current, authed, date, zone, router],
  );

  if (!current) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center px-4 py-20 text-center">
        <p className="font-display text-2xl font-bold">All done ✨</p>
        <p className="mt-2 text-[14px] text-ink-soft">
          Nothing left to review for this day.
        </p>
        <a
          href="/app/today"
          className="mt-6 rounded-xl bg-iris px-5 py-2.5 text-sm font-semibold text-ink-inverse"
        >
          Back to Today
        </a>
      </div>
    );
  }

  const cat = catClasses[current.category];

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center px-4 py-10">
      <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-ink-soft">
        Review today
      </p>
      <h1 className="mt-1 font-display text-3xl font-bold tracking-tight">
        {`${remaining} ${remaining === 1 ? "thing" : "things"} didn’t happen`}
      </h1>
      <p className="mt-1.5 text-[14px] text-ink-soft">
        Totally fine. Let&apos;s decide what they become.
      </p>

      <div
        className="mt-5 flex items-center gap-2"
        aria-label={`Item ${index + 1} of ${items.length + index}`}
      >
        {items.map((_, i) => (
          <span
            key={i}
            className={
              i === 0
                ? "h-2 w-6 rounded-full bg-iris"
                : "size-2 rounded-full bg-border-strong"
            }
          />
        ))}
      </div>

      <div className="mt-6 w-full rounded-3xl border border-border bg-surface p-6 shadow-float">
        <div className="flex items-center gap-4">
          <span
            className={`grid size-14 place-items-center rounded-2xl text-2xl ${cat.fill}`}
          >
            {current.emoji}
          </span>
          <div className="min-w-0">
            <p className={`truncate font-display text-xl font-bold ${cat.ink}`}>
              {current.title}
            </p>
            <p className="tnum mt-0.5 text-[13px] font-medium text-ink-soft">
              {current.time}
            </p>
          </div>
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-4 text-[13px] font-semibold text-danger">
          {error}
        </p>
      )}

      <div className="mt-6 grid w-full gap-2">
        <button
          type="button"
          disabled={busy || !authed}
          onClick={() => void act("complete")}
          className="flex items-center justify-center gap-2 rounded-2xl bg-success-soft py-3.5 text-[15px] font-semibold text-success focus-visible:ring-2 focus-visible:ring-iris focus-visible:outline-none disabled:opacity-50"
        >
          <Check size={18} strokeWidth={3} />
          I did it
        </button>
        <button
          type="button"
          disabled={busy || !authed}
          onClick={() => void act("tomorrow")}
          className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-surface py-3.5 text-[15px] font-semibold text-ink focus-visible:ring-2 focus-visible:ring-iris focus-visible:outline-none disabled:opacity-50"
        >
          <ArrowRight size={18} />
          Move to tomorrow
        </button>
        <button
          type="button"
          disabled={busy || !authed}
          onClick={() => void act("skip")}
          className="flex items-center justify-center gap-2 rounded-2xl py-3.5 text-[15px] font-semibold text-ink-soft hover:bg-surface-sunken focus-visible:ring-2 focus-visible:ring-iris focus-visible:outline-none disabled:opacity-50"
        >
          <SkipForward size={18} />
          Let it go
        </button>
      </div>

      {!authed && (
        <p className="mt-4 text-[13px] text-ink-soft">
          <a href="/sign-in" className="font-semibold text-iris">
            Sign in
          </a>{" "}
          to save review actions.
        </p>
      )}
    </div>
  );
}
