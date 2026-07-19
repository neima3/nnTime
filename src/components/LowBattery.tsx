"use client";

/**
 * Low-battery day (wave 2, Phase 5 — energy-aware planning).
 *
 * A per-day, client-side switch for "today I don't have it". When on:
 * high-energy timeline blocks dim and get a "heavy" tag (still visible —
 * honesty over hiding), and Pick-for-me prefers low/medium-energy options.
 * State lives in localStorage per calendar date and broadcasts via a window
 * event so any consumer can react without prop-drilling.
 */
import { useEffect, useState } from "react";
import { BatteryLow } from "lucide-react";

const EVENT = "kairo:low-battery";

function keyFor(date: string) {
  return `kairo-lowbatt-${date}`;
}

export function readLowBattery(date: string): boolean {
  try {
    return localStorage.getItem(keyFor(date)) === "1";
  } catch {
    return false;
  }
}

/** Live low-battery state for a date (updates across components). */
export function useLowBattery(date: string): boolean {
  const [on, setOn] = useState(false);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setOn(readLowBattery(date));
    /* eslint-enable react-hooks/set-state-in-effect */
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<{ date: string; on: boolean }>).detail;
      if (detail?.date === date) setOn(detail.on);
    };
    window.addEventListener(EVENT, onChange);
    return () => window.removeEventListener(EVENT, onChange);
  }, [date]);

  return on;
}

export function LowBatteryToggle({ date }: { date: string }) {
  const on = useLowBattery(date);

  const toggle = () => {
    const next = !on;
    try {
      if (next) localStorage.setItem(keyFor(date), "1");
      else localStorage.removeItem(keyFor(date));
    } catch {}
    window.dispatchEvent(
      new CustomEvent(EVENT, { detail: { date, on: next } }),
    );
  };

  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={toggle}
      title="Low-battery day: dim heavy activities, suggest lighter ones"
      className={`inline-flex items-center gap-1.5 rounded-2xl border px-3 py-2 text-[13px] font-semibold shadow-card transition-colors focus-visible:ring-2 focus-visible:ring-iris focus-visible:outline-none ${
        on
          ? "border-cat-butter-ink/30 bg-cat-butter text-cat-butter-ink"
          : "border-border bg-surface text-ink-soft hover:bg-surface-sunken hover:text-ink"
      }`}
    >
      <BatteryLow size={15} />
      {on ? "Low-battery day" : "Low battery?"}
    </button>
  );
}

/** Softened subline shown under the header when the day is low-battery. */
export function LowBatteryNote({ date }: { date: string }) {
  const on = useLowBattery(date);
  if (!on) return null;
  return (
    <p className="mb-4 text-[13px] font-medium text-ink-soft">
      Low-battery day — heavy things are dimmed. Doing less on purpose still
      counts as a plan.
    </p>
  );
}
