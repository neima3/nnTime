/**
 * Pure scheduling helpers (wave 4 "Slot it").
 */

/**
 * First gap of at least `needMin` minutes between `fromMin` and 22:00 given
 * busy [start,end) blocks. Starts no earlier than 07:00, snaps to 15-min
 * boundaries.
 */
export function firstFreeSlot(
  busy: { start: number; end: number }[],
  fromMin: number,
  needMin = 30,
): number | null {
  const dayEnd = 22 * 60;
  let cursor = Math.max(fromMin, 7 * 60);
  cursor = Math.ceil(cursor / 15) * 15;
  const sorted = [...busy].sort((a, b) => a.start - b.start);
  for (const b of sorted) {
    if (b.end <= cursor) continue;
    if (b.start - cursor >= needMin) break;
    cursor = Math.max(cursor, Math.ceil(b.end / 15) * 15);
  }
  return cursor + needMin <= dayEnd ? cursor : null;
}
