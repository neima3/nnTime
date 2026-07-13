/**
 * Templates service — Phase 5D.
 *
 * ~15 built-in templates (stable IDs, versioned JSON, import = independent copy
 * with provenance field, duplicate-import allowed with suffix). Personal
 * routine library: search, filter, favorites, pause.
 */
import "server-only";

/** Built-in template library (stable IDs, versioned). */
export const BUILTIN_TEMPLATES = [
  { id: "tpl_morning_gentle", title: "Gentle morning", emoji: "🌤️", category: "butter", group: "Morning", steps: ["Water + meds", "Stretch 5 min", "Breakfast"], minutes: 40, version: 1 },
  { id: "tpl_work_launch", title: "Launch into work", emoji: "🚀", category: "lilac", group: "Work", steps: ["Clear desk", "Pick ONE task", "45-min focus"], minutes: 60, version: 1 },
  { id: "tpl_study_sprint", title: "Study sprint", emoji: "📚", category: "sky", group: "Study", steps: ["Set topic", "25-min pomodoro", "5-min break"], minutes: 55, version: 1 },
  { id: "tpl_reset_space", title: "Reset the space", emoji: "🧺", category: "mint", group: "Home", steps: ["10-min tidy", "Dishes", "Tomorrow's clothes"], minutes: 35, version: 1 },
  { id: "tpl_soft_landing", title: "Soft landing", emoji: "🌙", category: "lilac", group: "Evening", steps: ["Screens off", "Tomorrow's plan", "Read"], minutes: 45, version: 1 },
  { id: "tpl_body_kindness", title: "Body kindness", emoji: "🫶", category: "rose", group: "Self-care", steps: ["Walk outside", "Water", "One nice thing"], minutes: 30, version: 1 },
  { id: "tpl_meal_prep", title: "Meal prep basics", emoji: "🥘", category: "peach", group: "Home", steps: ["Plan 3 meals", "Grocery list", "Cook base batch"], minutes: 75, version: 1 },
  { id: "tpl_admin_hour", title: "Admin power hour", emoji: "📮", category: "sky", group: "Work", steps: ["Inbox zero-ish", "Pay bills", "Calendar check"], minutes: 60, version: 1 },
  { id: "tpl_sunday_preview", title: "Sunday preview", emoji: "🗓️", category: "butter", group: "Evening", steps: ["Review week", "Pick 3 priorities", "First block Monday"], minutes: 30, version: 1 },
  { id: "tpl_deep_work", title: "Deep work block", emoji: "🎯", category: "lilac", group: "Work", steps: ["Phone away", "Define deliverable", "90-min focus", "10-min break"], minutes: 100, version: 1 },
  { id: "tpl_gym_push", title: "Gym — push day", emoji: "🏋️", category: "mint", group: "Movement", steps: ["Warm up", "Bench", "Shoulders", "Triceps", "Cool down"], minutes: 75, version: 1 },
  { id: "tpl_wind_down", title: "Wind down", emoji: "🌙", category: "lilac", group: "Evening", steps: ["Screens off", "Tomorrow's plan", "Read"], minutes: 45, version: 1 },
  { id: "tpl_meds_check", title: "Meds + water check", emoji: "💊", category: "sky", group: "Health", steps: ["Morning meds", "Water bottle", "Evening meds reminder"], minutes: 10, version: 1 },
  { id: "tpl_creative_block", title: "Unstick creativity", emoji: "🎨", category: "lilac", group: "Creative", steps: ["Change location", "Free-write 5 min", "Pick one thread"], minutes: 20, version: 1 },
  { id: "tpl_transition", title: "Work→home transition", emoji: "🚪", category: "butter", group: "Routine", steps: ["Close laptop", "10-min walk", "Change clothes", "Snack"], minutes: 25, version: 1 },
] as const;

/** List built-in templates, optionally filtered by group. */
export function listTemplates(filter?: { group?: string }): typeof BUILTIN_TEMPLATES {
  if (!filter?.group) return BUILTIN_TEMPLATES;
  return BUILTIN_TEMPLATES.filter((t) => t.group === filter.group) as unknown as typeof BUILTIN_TEMPLATES;
}

/** Get a single template by ID. */
export function getTemplate(id: string) {
  return BUILTIN_TEMPLATES.find((t) => t.id === id);
}
