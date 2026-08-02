const DEFAULT_FOCUS_DURATION_MIN = 25;
const MAX_FOCUS_DURATION_MIN = 24 * 60;

export function normalizeFocusDuration(
  value: string | string[] | undefined,
): number {
  if (typeof value !== "string") return DEFAULT_FOCUS_DURATION_MIN;
  const duration = Number(value);
  return Number.isInteger(duration) &&
    duration > 0 &&
    duration <= MAX_FOCUS_DURATION_MIN
    ? duration
    : DEFAULT_FOCUS_DURATION_MIN;
}
