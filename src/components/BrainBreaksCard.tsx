"use client";

/**
 * "Brain breaks" stats card — personal bests from localStorage only (games
 * are client-side by design). Hidden until at least one game has been played.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { readBest } from "@/lib/games";

export function BrainBreaksCard() {
  const [bests, setBests] = useState<{
    timeFeel: number | null;
    quickTap: number | null;
    grammar: number | null;
    spelling: number | null;
    match: number | null;
    breaths: number | null;
  } | null>(null);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setBests({
      timeFeel: readBest("time-feel"),
      quickTap: readBest("quick-tap"),
      grammar: readBest("grammar-snap"),
      spelling: readBest("spell-check"),
      match: readBest("emoji-match"),
      breaths: readBest("steady-breath"),
    });
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  if (
    !bests ||
    (bests.timeFeel == null &&
      bests.quickTap == null &&
      bests.grammar == null &&
      bests.spelling == null &&
      bests.match == null &&
      bests.breaths == null)
  )
    return null;

  const rows = [
    bests.timeFeel != null && {
      emoji: "⏳",
      label: "Time Feel — inner clock",
      value: `${bests.timeFeel}/100`,
    },
    bests.quickTap != null && {
      emoji: "⚡",
      label: "Quick Tap — best average",
      value: `${bests.quickTap} ms`,
    },
    bests.grammar != null && {
      emoji: "📝",
      label: "Grammar Snap — best round",
      value: `${bests.grammar}/8`,
    },
    bests.spelling != null && {
      emoji: "🔤",
      label: "Spell Check — best round",
      value: `${bests.spelling}/8`,
    },
    bests.match != null && {
      emoji: "🃏",
      label: "Emoji Match — fewest moves",
      value: `${bests.match}`,
    },
    bests.breaths != null && {
      emoji: "🫧",
      label: "Steady Breath — cycles breathed",
      value: `${bests.breaths}`,
    },
  ].filter(Boolean) as { emoji: string; label: string; value: string }[];

  return (
    <div className="rounded-3xl border border-border bg-surface p-5 shadow-card">
      <h3 className="font-display text-lg font-bold">Brain breaks</h3>
      <p className="mt-0.5 text-[12.5px] text-ink-soft">
        Personal bests · this device only
      </p>
      <ul className="mt-4 space-y-2.5">
        {rows.map((r) => (
          <li key={r.label} className="flex items-center gap-2.5">
            <span aria-hidden>{r.emoji}</span>
            <span className="flex-1 text-[13.5px] font-medium text-ink-soft">
              {r.label}
            </span>
            <span className="tnum text-[14px] font-bold">{r.value}</span>
          </li>
        ))}
      </ul>
      <Link
        href="/app/play"
        className="mt-4 inline-block text-[13px] font-bold text-iris hover:underline"
      >
        Take a break →
      </Link>
    </div>
  );
}
