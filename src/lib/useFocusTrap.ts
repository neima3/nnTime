"use client";

/**
 * useFocusTrap (R6) — keeps keyboard focus inside an open modal.
 *
 * When `active`, Tab / Shift+Tab wrap around the focusable elements inside the
 * container, and focus can't escape to the page behind the overlay (WCAG 2.4.3
 * + the "no keyboard trap escaping the modal" expectation for role="dialog").
 * Pointer this at the dialog element's ref. Does not manage initial focus —
 * each overlay already handles that; this only constrains Tab movement.
 */

import { useEffect, type RefObject } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function useFocusTrap(
  ref: RefObject<HTMLElement | null>,
  active: boolean,
) {
  useEffect(() => {
    if (!active) return;
    const node = ref.current;
    if (!node) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Tab") return;
      const focusable = Array.from(
        node!.querySelectorAll<HTMLElement>(FOCUSABLE),
      ).filter((el) => el.offsetParent !== null || el === document.activeElement);
      if (focusable.length === 0) {
        // Nothing to land on — keep focus on the dialog itself.
        e.preventDefault();
        node!.focus();
        return;
      }
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      const activeEl = document.activeElement as HTMLElement | null;

      if (e.shiftKey) {
        if (activeEl === first || !node!.contains(activeEl)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (activeEl === last || !node!.contains(activeEl)) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    node.addEventListener("keydown", onKeyDown);
    return () => node.removeEventListener("keydown", onKeyDown);
  }, [ref, active]);
}
