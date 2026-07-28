import { describe, expect, it } from "vitest";
import {
  checkedAddRoutineDuration,
  sumRoutineDurationMinutes,
} from "./routine-duration";

describe("routine duration aggregation", () => {
  it("accepts exact JSON safe-integer boundaries", () => {
    const maxNext = 2_147_483_647;
    const minNext = -2_147_483_648;

    expect(
      checkedAddRoutineDuration(Number.MAX_SAFE_INTEGER - maxNext, maxNext),
    ).toBe(Number.MAX_SAFE_INTEGER);
    expect(
      checkedAddRoutineDuration(Number.MIN_SAFE_INTEGER - minNext, minNext),
    ).toBe(Number.MIN_SAFE_INTEGER);
  });

  it("rejects the adjacent overflow and underflow from reachable states", () => {
    const maxNext = 2_147_483_647;
    const minNext = -2_147_483_648;

    expect(() =>
      checkedAddRoutineDuration(
        Number.MAX_SAFE_INTEGER - maxNext + 1,
        maxNext,
      ),
    ).toThrow(RangeError);
    expect(() =>
      checkedAddRoutineDuration(
        Number.MIN_SAFE_INTEGER - minNext - 1,
        minNext,
      ),
    ).toThrow(RangeError);
  });

  it("preserves totals above Int32 and treats null duration as zero", () => {
    expect(
      sumRoutineDurationMinutes([
        { durationMin: 2_147_483_647 },
        { durationMin: 1 },
        { durationMin: null },
      ]),
    ).toBe(2_147_483_648);
  });
});
