"use client";

/**
 * Stamps `data-hydrated` on <html> once React has taken over the document.
 *
 * This is the only reliable "safe to interact" signal for real-browser tests:
 * before hydration a controlled form silently eats fills, and a submit falls
 * back to a native GET that reloads the page empty. Full document loads reset
 * the attribute (server HTML never carries it); client-side navigations keep
 * it, which is accurate — React is already driving the page.
 */
import { useEffect } from "react";

export function HydrationMarker() {
  useEffect(() => {
    document.documentElement.dataset.hydrated = "true";
  }, []);
  return null;
}
