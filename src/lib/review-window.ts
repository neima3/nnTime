/**
 * Review Today only judges blocks that have actually had their chance.
 *
 * A pending block whose end is still ahead of "now" has not failed to happen
 * yet, so it must not be offered to "let go" or "move to tomorrow". Those are
 * counted (so the screen can say they are still coming) but never listed.
 *
 * `nowMin` is minutes from midnight in the planning zone; `null` means the day
 * under review is not today, in which case every pending block is in scope.
 */
export function partitionReviewItems<
  T extends { startMin: number; durationMin: number },
>(items: T[], nowMin: number | null): { past: T[]; upcoming: number } {
  if (nowMin == null) return { past: items, upcoming: 0 };
  const past = items.filter((item) => item.startMin + item.durationMin <= nowMin);
  return { past, upcoming: items.length - past.length };
}
