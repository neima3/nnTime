export interface RoutineDurationStep {
  durationMin: number | null;
}

const unsafeRoutineDurationMessage =
  "Routine duration aggregate exceeds JSON safe-integer bounds";

export function checkedAddRoutineDuration(
  accumulator: number,
  nextDuration: number,
): number {
  if (
    !Number.isSafeInteger(accumulator) ||
    !Number.isSafeInteger(nextDuration)
  ) {
    throw new RangeError(unsafeRoutineDurationMessage);
  }
  const result = accumulator + nextDuration;
  if (!Number.isSafeInteger(result)) {
    throw new RangeError(unsafeRoutineDurationMessage);
  }
  return result;
}

export function sumRoutineDurationMinutes(
  steps: Iterable<RoutineDurationStep>,
): number {
  let total = 0;
  for (const step of steps) {
    total = checkedAddRoutineDuration(total, step.durationMin ?? 0);
  }
  return total;
}
