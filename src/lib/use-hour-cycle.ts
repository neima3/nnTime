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
import {
  createContext,
  createElement,
  useContext,
  useSyncExternalStore,
  type ReactNode,
} from "react";
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

/**
 * The server-known hour cycle, provided by the /app layout so SSR emits the
 * right format in the first byte of HTML. A hardcoded server snapshot here
 * meant every 12-hour account got 24-hour markup, visibly repainted after
 * hydration — the exact flash this hook exists to prevent.
 */
const HourCycleContext = createContext<HourCycle>("h24");

export function HourCycleProvider(props: {
  value: HourCycle;
  children: ReactNode;
}) {
  return createElement(HourCycleContext.Provider, { value: props.value }, props.children);
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
  const serverValue = useContext(HourCycleContext);
  return useSyncExternalStore(subscribe, getSnapshot, () => serverValue);
}
