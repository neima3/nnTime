"use client";

/**
 * Review Today actions — complete / let-go / move tomorrow (10× Phase 10).
 */

import { useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, LogIn, SkipForward } from "lucide-react";
import { catClasses, type CategoryId } from "@/lib/mock";
import { localMinutesToInstant } from "@/lib/adapters";
import { authPageHref } from "@/lib/auth-return";
import { sendRebasedStatusChange } from "@/lib/offline-mutation";
import { celebrate } from "./Celebration";
import { notifyDayChanged } from "./NowBar";
import { toast } from "./Toast";

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
  const signInHref = authPageHref("sign-in", "/app/review");
  const signUpHref = authPageHref("sign-up", "/app/review");
  const [items, setItems] = useState(initial);
  const [index] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const current = items[index];
  const remaining = items.length - index;

  const act = useCallback(
    async (kind: "complete" | "skip" | "tomorrow") => {
      if (!current || !authed) return false;
      setBusy(true);
      setError(null);
      try {
        if (kind === "complete" || kind === "skip") {
          const delivery = await sendRebasedStatusChange({
            path: `/api/v1/activities/${current.id}`,
            onlineRevision: current.revision,
            body: {
              editScope: "this",
              occurrenceKey: current.occurrenceKey,
              status: kind === "complete" ? "completed" : "skipped",
              completedAt:
                kind === "complete" ? new Date().toISOString() : null,
            },
          });
          if (delivery.state === "unavailable") {
            setError(
              "You’re offline and this device couldn’t save that change. Reconnect and try again.",
            );
            setBusy(false);
            return false;
          }
          if (
            delivery.state === "server" &&
            !delivery.response.ok
          ) {
            setError("Couldn't update it — try again");
            setBusy(false);
            return false;
          }
          if (delivery.state === "queued") {
            toast("Saved on this device — it’ll sync when you’re back");
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
            setError("Couldn't reschedule it — try again");
            setBusy(false);
            return false;
          }
        }
        setItems((prev) => prev.filter((x) => x.id !== current.id));
        // index stays; next item slides into place
        setBusy(false);
        router.refresh();
        notifyDayChanged();
        return true;
      } catch {
        setError("Couldn't reach the server — try again?");
        setBusy(false);
        return false;
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
      <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-iris">
        {authed ? "Review today" : "Sample planner"}
      </p>
      <h1 className="mt-1 text-center text-pretty font-display text-3xl font-bold tracking-tight">
        {authed
          ? `${remaining} ${remaining === 1 ? "thing" : "things"} didn’t happen`
          : "A review with Kairo"}
      </h1>
      <p className="mt-1.5 text-center text-pretty text-[14px] text-ink-soft">
        {authed
          ? "Totally fine. Let’s decide what they become."
          : "See how unfinished plans can move forward without guilt."}
      </p>

      <div aria-hidden="true" className="mt-5 flex items-center gap-2">
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
            {!authed && (
              <p className="mb-0.5 text-[11px] font-bold uppercase tracking-[0.12em] text-ink-soft">
                Sample activity
              </p>
            )}
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

      {authed ? (
        <div className="mt-6 grid w-full gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={async (e) => {
              const { clientX, clientY } = e;
              const accepted = await act("complete");
              if (accepted) celebrate(clientX, clientY);
            }}
            className="flex items-center justify-center gap-2 rounded-2xl bg-success-soft py-3.5 text-[15px] font-semibold text-success focus-visible:ring-2 focus-visible:ring-iris focus-visible:outline-none disabled:opacity-50"
          >
            <Check size={18} strokeWidth={3} />
            I did it
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void act("tomorrow")}
            className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-surface py-3.5 text-[15px] font-semibold text-ink focus-visible:ring-2 focus-visible:ring-iris focus-visible:outline-none disabled:opacity-50"
          >
            <ArrowRight size={18} />
            Move to tomorrow
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void act("skip")}
            className="flex items-center justify-center gap-2 rounded-2xl py-3.5 text-[15px] font-semibold text-ink-soft hover:bg-surface-sunken focus-visible:ring-2 focus-visible:ring-iris focus-visible:outline-none disabled:opacity-50"
          >
            <SkipForward size={18} />
            Let it go
          </button>
        </div>
      ) : (
        <section
          aria-labelledby="review-auth-heading"
          className="mt-6 w-full rounded-3xl border border-border bg-surface p-5 shadow-card"
        >
          <div className="flex items-start gap-3">
            <span
              aria-hidden="true"
              className="grid size-10 shrink-0 place-items-center rounded-2xl bg-iris-soft text-iris"
            >
              <LogIn size={18} />
            </span>
            <div>
              <h2
                id="review-auth-heading"
                className="font-display text-[16px] font-bold text-ink"
              >
                Review privately when you’re ready
              </h2>
              <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">
                Sign in to decide what happens to unfinished plans and keep
                every choice private and synced.
              </p>
            </div>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto]">
            <Link
              href={signInHref}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-iris px-4 text-[14px] font-semibold text-ink-inverse transition-all hover:bg-iris-deep active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-iris focus-visible:ring-offset-2 focus-visible:ring-offset-surface focus-visible:outline-none"
            >
              <LogIn size={17} />
              Sign in to review
            </Link>
            <Link
              href={signUpHref}
              className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-border px-4 text-[14px] font-semibold text-ink-soft transition-colors hover:bg-surface-sunken hover:text-ink active:bg-iris-ghost focus-visible:ring-2 focus-visible:ring-iris focus-visible:ring-offset-2 focus-visible:ring-offset-surface focus-visible:outline-none"
            >
              Create an account
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
