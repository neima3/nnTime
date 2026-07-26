"use client";

/**
 * The account's clock format, available synchronously on the first render.
 *
 * The /app layout stamps `data-hour-cycle` onto <html> from the server-side
 * settings, so client components read it straight from the DOM instead of
 * waiting on a fetch — no 24-hour flash before flipping to 12-hour.
 *
 * Settings updates dispatch `kairo:hour-cycle`, which re-renders every consumer
 * without a reload.
 */
import { useSyncExternalStore } from "react";
import { toHourCycle, type HourCycle } from "./time-format";

export const HOUR_CYCLE_EVENT = "kairo:hour-cycle";

function subscribe(onChange: () => void): () => void {
  window.addEventListener(HOUR_CYCLE_EVENT, onChange);
  return () => window.removeEventListener(HOUR_CYCLE_EVENT, onChange);
}

/** Read the attribute the layout stamped. Returns a stable literal, so React's
 *  snapshot comparison never sees a "changed" value that didn't change. */
function getSnapshot(): HourCycle {
  return toHourCycle(document.documentElement.dataset.hourCycle);
}

/** SSR has no DOM; 24-hour matches the pre-hydration markup the server emits. */
function getServerSnapshot(): HourCycle {
  return "h24";
}

/** Publish a new hour cycle: stamp the DOM and tell every consumer. */
export function publishHourCycle(value: HourCycle): void {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.hourCycle = value;
  window.dispatchEvent(new CustomEvent(HOUR_CYCLE_EVENT, { detail: value }));
}

/**
 * useSyncExternalStore rather than useState+useEffect: the DOM attribute *is*
 * the store, so this reads it during render (no post-mount setState, no flash)
 * and re-renders only when the value actually changes.
 */
export function useHourCycle(): HourCycle {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
