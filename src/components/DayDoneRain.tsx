"use client";

/**
 * One-time celebration when a day first reaches all-done (wave 3 delight):
 * a short cascade of particle bursts across the top of the page. Fires once
 * per calendar date (localStorage), and inherits Celebration's respect for
 * reduced motion / reduced stimulation.
 */
import { useEffect } from "react";
import { celebrate } from "./Celebration";

export function DayDoneRain({ date }: { date: string }) {
  useEffect(() => {
    const key = `kairo-daydone-${date}`;
    try {
      if (localStorage.getItem(key) === "1") return;
      localStorage.setItem(key, "1");
    } catch {
      return;
    }
    const w = window.innerWidth;
    const origins = [0.2, 0.45, 0.7, 0.9, 0.32, 0.6];
    origins.forEach((x, i) => {
      window.setTimeout(() => {
        celebrate(w * x, 120 + (i % 3) * 60);
      }, i * 180);
    });
  }, [date]);

  return null;
}
