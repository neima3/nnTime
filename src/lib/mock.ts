/* Deterministic mock data for the design screens.
   "Now" is fixed at 13:00 so SSR output never drifts. */

export type CategoryId =
  | "peach"
  | "butter"
  | "mint"
  | "sky"
  | "lilac"
  | "rose";

export type Activity = {
  id: string;
  title: string;
  emoji: string;
  start: number; // minutes from midnight
  duration: number; // minutes
  category: CategoryId;
  done?: boolean;
  checklist?: { label: string; done: boolean }[];
  energy?: "low" | "medium" | "high";
};

export const NOW_MIN = 13 * 60; // 13:00

export const DAY = {
  label: "Saturday",
  date: "July 12",
  energy: "medium" as const,
};

export const activities: Activity[] = [
  {
    id: "a1",
    title: "Morning reset",
    emoji: "🌤️",
    start: 8 * 60,
    duration: 45,
    category: "butter",
    done: true,
    checklist: [
      { label: "Water + meds", done: true },
      { label: "Stretch", done: true },
      { label: "Make bed", done: true },
    ],
  },
  {
    id: "a2",
    title: "Breakfast",
    emoji: "🥐",
    start: 8 * 60 + 45,
    duration: 30,
    category: "peach",
    done: true,
  },
  {
    id: "a3",
    title: "Deep work — Kairo design",
    emoji: "🎨",
    start: 9 * 60 + 30,
    duration: 120,
    category: "lilac",
    done: true,
    energy: "high",
    checklist: [
      { label: "Timeline screen", done: true },
      { label: "Focus mode", done: true },
      { label: "Design tokens", done: false },
    ],
  },
  {
    id: "a4",
    title: "Walk + podcast",
    emoji: "🚶",
    start: 11 * 60 + 45,
    duration: 40,
    category: "mint",
    done: true,
    energy: "low",
  },
  {
    id: "a5",
    title: "Lunch",
    emoji: "🍜",
    start: 12 * 60 + 30,
    duration: 45,
    category: "peach",
  },
  {
    id: "a6",
    title: "Pharmacy shift prep",
    emoji: "💊",
    start: 13 * 60 + 30,
    duration: 60,
    category: "sky",
    energy: "medium",
    checklist: [
      { label: "Review schedule", done: false },
      { label: "Pack bag", done: false },
    ],
  },
  {
    id: "a7",
    title: "Call Sahar",
    emoji: "📞",
    start: 15 * 60,
    duration: 30,
    category: "rose",
  },
  {
    id: "a8",
    title: "Gym — push day",
    emoji: "🏋️",
    start: 17 * 60,
    duration: 75,
    category: "mint",
    energy: "high",
  },
  {
    id: "a9",
    title: "Dinner + unwind",
    emoji: "🍽️",
    start: 19 * 60,
    duration: 90,
    category: "peach",
  },
  {
    id: "a10",
    title: "Wind down",
    emoji: "🌙",
    start: 21 * 60 + 30,
    duration: 45,
    category: "lilac",
    checklist: [
      { label: "Screens off", done: false },
      { label: "Tomorrow's plan", done: false },
      { label: "Read", done: false },
    ],
  },
];

export const inbox = [
  { id: "t1", title: "Renew passport", emoji: "🛂", category: "sky" as const },
  { id: "t2", title: "Order cat food", emoji: "🐈", category: "butter" as const },
  { id: "t3", title: "Reply to Santos email", emoji: "✉️", category: "rose" as const },
];

export const routines = [
  {
    id: "r1",
    title: "Morning reset",
    emoji: "🌤️",
    steps: 5,
    minutes: 45,
    category: "butter" as const,
    days: "Every day · 8:00",
  },
  {
    id: "r2",
    title: "Deep work block",
    emoji: "🎯",
    steps: 3,
    minutes: 120,
    category: "lilac" as const,
    days: "Weekdays · 9:30",
  },
  {
    id: "r3",
    title: "Gym — push/pull",
    emoji: "🏋️",
    steps: 6,
    minutes: 75,
    category: "mint" as const,
    days: "Mon · Wed · Sat",
  },
  {
    id: "r4",
    title: "Wind down",
    emoji: "🌙",
    steps: 4,
    minutes: 45,
    category: "lilac" as const,
    days: "Every day · 21:30",
  },
  {
    id: "r5",
    title: "Sunday reset",
    emoji: "🧺",
    steps: 7,
    minutes: 90,
    category: "sky" as const,
    days: "Sundays · 11:00",
  },
  {
    id: "r6",
    title: "Meal prep",
    emoji: "🥘",
    steps: 4,
    minutes: 60,
    category: "peach" as const,
    days: "Sundays · 16:00",
  },
];

export const catClasses: Record<
  CategoryId,
  { fill: string; ink: string; dot: string }
> = {
  peach: { fill: "bg-cat-peach", ink: "text-cat-peach-ink", dot: "bg-cat-peach-ink" },
  butter: { fill: "bg-cat-butter", ink: "text-cat-butter-ink", dot: "bg-cat-butter-ink" },
  mint: { fill: "bg-cat-mint", ink: "text-cat-mint-ink", dot: "bg-cat-mint-ink" },
  sky: { fill: "bg-cat-sky", ink: "text-cat-sky-ink", dot: "bg-cat-sky-ink" },
  lilac: { fill: "bg-cat-lilac", ink: "text-cat-lilac-ink", dot: "bg-cat-lilac-ink" },
  rose: { fill: "bg-cat-rose", ink: "text-cat-rose-ink", dot: "bg-cat-rose-ink" },
};

export function fmt(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}:${m.toString().padStart(2, "0")}`;
}

export function fmtDuration(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}
