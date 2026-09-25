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

/**
 * Where a brand-new activity should start when the person didn't pick a time.
 *
 * Another day: 09:00. Today: the first gap of `needMin` from a few minutes
 * from now, so "+" at 7 pm never proposes a slot that already happened or
 * one that sits on top of dinner. Unlike `firstFreeSlot` this looks all the
 * way to midnight — an evening plan is still a plan — and with no gap big
 * enough it lands right after the last booked block.
 */
export function suggestNewStart(
  busy: { start: number; end: number }[],
  nowMin: number | null,
  needMin = 45,
): number {
  if (nowMin == null) return 9 * 60;
  const q = (m: number) => Math.ceil(m / 15) * 15;
  let cursor = q(Math.max(nowMin + 5, 7 * 60));
  for (const b of [...busy].sort((a, c) => a.start - c.start)) {
    if (b.end <= cursor) continue;
    if (b.start - cursor >= needMin) break;
    cursor = Math.max(cursor, q(b.end));
  }
  return Math.min(cursor, 23 * 60 + 45);
}
