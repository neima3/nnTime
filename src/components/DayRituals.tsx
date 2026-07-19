"use client";

/**
 * Day rituals (wave 2, Phase 4 — the transitions are where ADHD days slip).
 *
 * Morning kickoff (before 11:00, nearly-empty day): three one-tap ways to
 * start. Evening shutdown (after 19:00, unfinished items): close the day
 * kindly — review, or carry everything to tomorrow in one tap. Each card
 * dismisses per-day (localStorage), never nags twice.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CalendarCheck,
  Copy,
  LayoutTemplate,
  Loader2,
  Moon,
  Sparkles,
  Sunrise,
  X,
} from "lucide-react";
import { dateToMinutesFromMidnight, localMinutesToInstant } from "@/lib/adapters";
import { toast } from "./Toast";
import { notifyDayChanged } from "./NowBar";

interface UnfinishedItem {
  id: string;
  revision: number;
  occurrenceKey: string;
  startMin: number;
}

export function DayRituals({
  zone,
  date,
  activityCount,
  unfinished,
}: {
  zone: string;
  date: string;
  activityCount: number;
  /** Today's not-done activities (for carry-forward). */
  unfinished: UnfinishedItem[];
}) {
  const router = useRouter();
  const [nowMin, setNowMin] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState<"morning" | "evening" | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setNowMin(dateToMinutesFromMidnight(new Date(), zone));
    try {
      const v = localStorage.getItem(`kairo-ritual-${date}`);
      if (v === "morning" || v === "evening") setDismissed(v);
    } catch {}
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [zone, date]);

  if (nowMin == null) return null;

  // Dev-only window override so both cards can be exercised in QA.
  let forced: "morning" | "evening" | null = null;
  if (
    typeof window !== "undefined" &&
    window.location.hostname === "localhost"
  ) {
    const p = new URLSearchParams(window.location.search).get("ritualDebug");
    if (p === "morning" || p === "evening") forced = p;
  }

  const morningWindow = forced === "morning" || (forced == null && nowMin < 11 * 60);
  const eveningWindow = forced === "evening" || (forced == null && nowMin >= 19 * 60);

  const dismiss = (which: "morning" | "evening") => {
    setDismissed(which);
    try {
      localStorage.setItem(`kairo-ritual-${date}`, which);
    } catch {}
  };

  const copyYesterday = async () => {
    setBusy(true);
    try {
      const [y, m, d] = date.split("-").map(Number);
      const yesterday = new Date(Date.UTC(y!, m! - 1, d! - 1))
        .toISOString()
        .slice(0, 10);
      const res = await fetch(`/api/v1/day/${yesterday}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      interface WireActivity {
        title: string;
        emoji: string | null;
        dtstartLocal: string;
        durationMin: number;
        categoryId: string | null;
        energy: string | null;
        source: string;
        rrule: string | null;
      }
      // One-off activities only — recurring ones repeat on their own.
      const toCopy = (data.activities as WireActivity[]).filter(
        (a) => !a.rrule && a.source === "manual",
      );
      if (toCopy.length === 0) {
        toast("Yesterday had nothing copyable — recurring things repeat on their own");
        setBusy(false);
        return;
      }
      let copied = 0;
      for (const a of toCopy) {
        const startMin = dateToMinutesFromMidnight(new Date(a.dtstartLocal), zone);
        const create = await fetch("/api/v1/activities", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tz: zone,
            dtstartLocal: localMinutesToInstant(date, startMin, zone),
            title: a.title,
            emoji: a.emoji ?? "📋",
            categoryId: a.categoryId ?? undefined,
            durationMin: a.durationMin,
            energy: a.energy ?? null,
            source: "manual",
          }),
        });
        if (create.ok) copied++;
      }
      toast(`Copied ${copied} from yesterday`);
      dismiss("morning");
      notifyDayChanged();
      router.refresh();
    } catch {
      toast("Couldn't copy yesterday — try Plan my day instead");
    }
    setBusy(false);
  };

  const carryForward = async () => {
    setBusy(true);
    try {
      const [y, m, d] = date.split("-").map(Number);
      const tomorrow = new Date(Date.UTC(y!, m! - 1, d! + 1))
        .toISOString()
        .slice(0, 10);
      let moved = 0;
      for (const item of unfinished) {
        const res = await fetch(`/api/v1/activities/${item.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "If-Match": String(item.revision),
          },
          body: JSON.stringify({
            editScope: "this",
            occurrenceKey: item.occurrenceKey,
            startAt: localMinutesToInstant(tomorrow, item.startMin, zone),
          }),
        });
        if (res.ok) moved++;
      }
      toast(
        moved > 0
          ? `Moved ${moved} to tomorrow — today is closed`
          : "Nothing needed moving",
      );
      dismiss("evening");
      notifyDayChanged();
      router.refresh();
    } catch {
      toast("Couldn't move everything — try the review flow");
    }
    setBusy(false);
  };

  if (morningWindow && activityCount < 2 && dismissed !== "morning") {
    return (
      <div className="mb-5 rounded-3xl border border-cat-butter-ink/20 bg-cat-butter/40 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-xl bg-cat-butter text-lg" aria-hidden>
              <Sunrise size={18} className="text-cat-butter-ink" />
            </span>
            <div>
              <p className="text-[14.5px] font-bold">Set up your day</p>
              <p className="text-[12.5px] font-medium text-ink-soft">
                A shape for the day beats a blank page. Pick a way in:
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Dismiss for today"
            onClick={() => dismiss("morning")}
            className="rounded-lg p-1 text-ink-faint hover:text-ink"
          >
            <X size={15} />
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            href="/app/planner"
            className="inline-flex items-center gap-1.5 rounded-xl bg-iris px-3.5 py-2 text-[13px] font-semibold text-ink-inverse transition-colors hover:bg-iris-deep"
          >
            <Sparkles size={14} />
            Plan with AI
          </Link>
          <Link
            href="/app/templates"
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface px-3.5 py-2 text-[13px] font-semibold text-ink-soft hover:text-ink"
          >
            <LayoutTemplate size={14} />
            Start from a template
          </Link>
          <button
            type="button"
            disabled={busy}
            onClick={() => void copyYesterday()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface px-3.5 py-2 text-[13px] font-semibold text-ink-soft hover:text-ink disabled:opacity-50"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Copy size={14} />}
            Copy yesterday
          </button>
        </div>
      </div>
    );
  }

  if (eveningWindow && unfinished.length > 0 && dismissed !== "evening") {
    return (
      <div className="mb-5 rounded-3xl border border-cat-lilac-ink/20 bg-cat-lilac/40 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-xl bg-cat-lilac text-lg" aria-hidden>
              <Moon size={17} className="text-cat-lilac-ink" />
            </span>
            <div>
              <p className="text-[14.5px] font-bold">Close the day</p>
              <p className="text-[12.5px] font-medium text-ink-soft">
                {unfinished.length}{" "}
                {unfinished.length === 1 ? "thing" : "things"} still open —
                decide once, then rest.
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Dismiss for today"
            onClick={() => dismiss("evening")}
            className="rounded-lg p-1 text-ink-faint hover:text-ink"
          >
            <X size={15} />
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            href="/app/review"
            className="inline-flex items-center gap-1.5 rounded-xl bg-iris px-3.5 py-2 text-[13px] font-semibold text-ink-inverse transition-colors hover:bg-iris-deep"
          >
            <CalendarCheck size={14} />
            Review one by one
          </Link>
          <button
            type="button"
            disabled={busy}
            onClick={() => void carryForward()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface px-3.5 py-2 text-[13px] font-semibold text-ink-soft hover:text-ink disabled:opacity-50"
          >
            {busy ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <ArrowRight size={14} />
            )}
            Carry all to tomorrow
          </button>
        </div>
      </div>
    );
  }

  return null;
}
