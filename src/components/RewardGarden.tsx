"use client";

/**
 * Reward Garden (P12 — growth that isn't a streak).
 *
 * Streaks punish the missed day. The garden never does: every finished thing
 * and every focus session plants something, and the garden only ever grows.
 * A hero plant advances through stages by total effort; a meadow below spreads
 * one bloom per few completions so progress stays visible even on quiet weeks.
 *
 * Pure/derived — no new API. Fed by the same stats the page already loads.
 */

type Stage = {
  emoji: string;
  name: string;
  /** Points needed to reach this stage. */
  at: number;
};

const STAGES: Stage[] = [
  { emoji: "🌱", name: "a seed", at: 0 },
  { emoji: "🌿", name: "a sprout", at: 3 },
  { emoji: "🪴", name: "growing", at: 8 },
  { emoji: "🌷", name: "in bloom", at: 16 },
  { emoji: "🌳", name: "flourishing", at: 32 },
];

/** One bloom per this many completions in the meadow row. */
const PER_BLOOM = 3;
const MEADOW_BLOOMS = ["🌸", "🌼", "🌻", "🌷", "🪻", "🌺"];

export function RewardGarden({
  totalCompleted,
  totalFocusMin,
  days,
}: {
  totalCompleted: number;
  totalFocusMin: number;
  days: number;
}) {
  // Each completion is a point; each ~25-min focus block adds one too.
  const focusBlocks = Math.floor(totalFocusMin / 25);
  const points = totalCompleted + focusBlocks;

  let stageIdx = 0;
  for (let i = STAGES.length - 1; i >= 0; i--) {
    if (points >= STAGES[i].at) {
      stageIdx = i;
      break;
    }
  }
  const stage = STAGES[stageIdx];
  const next = STAGES[stageIdx + 1];
  const toNext = next ? next.at - points : 0;

  const bloomCount = Math.min(24, Math.floor(totalCompleted / PER_BLOOM));

  return (
    <section className="rise-in relative overflow-hidden rounded-3xl border border-border bg-surface p-5 shadow-card sm:col-span-2">
      {/* soft ground gradient */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-cat-mint/40 to-transparent"
      />
      <div className="relative">
        <h2 className="font-display text-base font-bold">Your garden</h2>
        <p className="mt-0.5 text-[12.5px] text-ink-soft">
          It only ever grows — no day can undo it
        </p>

        <div className="mt-4 flex items-center gap-4">
          <div className="grid size-20 shrink-0 place-items-center rounded-3xl bg-cat-mint/50 text-5xl">
            <span aria-hidden>{stage.emoji}</span>
          </div>
          <div className="min-w-0">
            <p className="font-display text-xl font-bold capitalize leading-tight">
              {stage.name}
            </p>
            <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">
              {points === 0 ? (
                <>Finish one thing or a focus block to plant your first seed.</>
              ) : next ? (
                <>
                  <span className="font-semibold text-ink">{points}</span> planted
                  in {days} days · {toNext} more until {next.name}
                </>
              ) : (
                <>
                  <span className="font-semibold text-ink">{points}</span> planted
                  in {days} days · fully grown, and still going
                </>
              )}
            </p>
          </div>
        </div>

        {bloomCount > 0 && (
          <div
            className="mt-4 flex flex-wrap gap-1 text-lg"
            aria-label={`Meadow of ${bloomCount} blooms`}
          >
            {Array.from({ length: bloomCount }, (_, i) => (
              <span key={i} aria-hidden>
                {MEADOW_BLOOMS[i % MEADOW_BLOOMS.length]}
              </span>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
