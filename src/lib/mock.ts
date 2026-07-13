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

/* ---- Phase 0.5c design-reference data ---- */

export type InboxItem = {
  id: string;
  title: string;
  emoji: string;
  category: CategoryId;
  tags: string[];
  priority: "none" | "low" | "high";
};

export const inboxItems: InboxItem[] = [
  { id: "i1", title: "Renew passport", emoji: "🛂", category: "sky", tags: ["errands"], priority: "high" },
  { id: "i2", title: "Order cat food", emoji: "🐈", category: "butter", tags: ["errands", "home"], priority: "low" },
  { id: "i3", title: "Reply to Santos email", emoji: "✉️", category: "rose", tags: ["work"], priority: "high" },
  { id: "i4", title: "Look into standing desk", emoji: "🪑", category: "mint", tags: ["home"], priority: "none" },
  { id: "i5", title: "Book dentist cleaning", emoji: "🦷", category: "sky", tags: ["health"], priority: "low" },
  { id: "i6", title: "Plan Sahar's birthday", emoji: "🎂", category: "rose", tags: ["family"], priority: "none" },
];

export const monthDays: {
  date: number;
  isToday?: boolean;
  otherMonth?: boolean;
  dots: CategoryId[];
  more?: number;
}[] = (() => {
  const days: { date: number; isToday?: boolean; otherMonth?: boolean; dots: CategoryId[]; more?: number }[] = [];
  // Kairo's fictional July: the 12th is a Saturday (matches week view),
  // so July 1 falls on Tuesday and the grid starts Monday June 30.
  days.push({ date: 30, otherMonth: true, dots: ["butter", "lilac"] });
  const dotsByDay: Record<number, CategoryId[]> = {
    1: ["butter", "lilac", "sky"], 2: ["sky", "rose"], 3: ["lilac", "peach"],
    4: ["mint"], 5: ["sky", "peach"], 6: ["butter", "lilac", "sky"],
    7: ["butter", "sky"], 8: ["butter", "sky", "lilac"], 9: ["lilac", "mint"],
    10: ["sky", "rose"], 11: ["lilac", "peach"], 12: ["butter", "lilac", "sky"],
    13: ["sky", "peach"], 14: ["butter", "sky"], 15: ["lilac"],
    16: ["sky", "rose", "mint"], 17: ["lilac", "peach"], 18: ["mint", "butter"],
    19: ["sky"], 20: ["butter", "lilac"], 21: ["sky", "mint"],
    22: ["lilac", "rose"], 23: ["sky"], 24: ["lilac", "peach", "butter"],
    25: ["mint"], 26: ["sky", "peach"], 27: ["butter", "lilac"],
    28: ["sky", "rose"], 29: ["lilac"], 30: ["mint", "sky"], 31: ["peach", "lilac"],
  };
  for (let d = 1; d <= 31; d++) {
    days.push({
      date: d,
      isToday: d === 12,
      dots: (dotsByDay[d] ?? []).slice(0, 3),
      more: d === 12 ? 2 : d === 8 ? 1 : undefined,
    });
  }
  days.push({ date: 1, otherMonth: true, dots: [] });
  days.push({ date: 2, otherMonth: true, dots: ["butter"] });
  days.push({ date: 3, otherMonth: true, dots: ["sky"] });
  return days;
})();

export const reviewItems = [
  { id: "rv1", title: "Pharmacy shift prep", emoji: "💊", category: "sky" as CategoryId, time: "13:30 – 14:30", checklist: "1 of 2 steps done" },
  { id: "rv2", title: "Call Sahar", emoji: "📞", category: "rose" as CategoryId, time: "15:00 – 15:30" },
  { id: "rv3", title: "Wind down", emoji: "🌙", category: "lilac" as CategoryId, time: "21:30 – 22:15", checklist: "0 of 3 steps done" },
];

export const templates = [
  { id: "tp1", title: "Gentle morning", emoji: "🌤️", category: "butter" as CategoryId, group: "Morning", steps: ["Water + meds", "Stretch 5 min", "Breakfast"], minutes: 40 },
  { id: "tp2", title: "Launch into work", emoji: "🚀", category: "lilac" as CategoryId, group: "Work", steps: ["Clear desk", "Pick ONE task", "45-min focus"], minutes: 60 },
  { id: "tp3", title: "Study sprint", emoji: "📚", category: "sky" as CategoryId, group: "Study", steps: ["Set topic", "25-min pomodoro", "5-min break"], minutes: 55 },
  { id: "tp4", title: "Reset the space", emoji: "🧺", category: "mint" as CategoryId, group: "Home", steps: ["10-min tidy", "Dishes", "Tomorrow's clothes"], minutes: 35 },
  { id: "tp5", title: "Soft landing", emoji: "🌙", category: "lilac" as CategoryId, group: "Evening", steps: ["Screens off", "Tomorrow's plan", "Read"], minutes: 45 },
  { id: "tp6", title: "Body kindness", emoji: "🫶", category: "rose" as CategoryId, group: "Self-care", steps: ["Walk outside", "Water", "One nice thing"], minutes: 30 },
  { id: "tp7", title: "Meal prep basics", emoji: "🥘", category: "peach" as CategoryId, group: "Home", steps: ["Plan 3 meals", "Grocery list", "Cook base batch"], minutes: 75 },
  { id: "tp8", title: "Admin power hour", emoji: "📮", category: "sky" as CategoryId, group: "Work", steps: ["Inbox zero-ish", "Pay bills", "Calendar check"], minutes: 60 },
  { id: "tp9", title: "Sunday preview", emoji: "🗓️", category: "butter" as CategoryId, group: "Evening", steps: ["Review week", "Pick 3 priorities", "First block Monday"], minutes: 30 },
];

export const statWeek = {
  completion: [80, 60, 100, 40, 75, 40, 0], // Mon..Sun %
  focusMin: [95, 120, 60, 45, 110, 25, 0],
  energy: { low: 4, medium: 9, high: 5 },
  moods: ["🙂", "😌", "😄", "😮‍💨", "🙂", "😌", null] as (string | null)[],
  streak: { current: 5, best: 11 },
};
