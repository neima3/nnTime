import { describe, expect, it } from "vitest";
import { nextDateStr, seriesIdsOnDay } from "./next-day-copies";

const respond = (status: number, body: unknown) =>
  (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

describe("nextDateStr", () => {
  it("rolls months and years", () => {
    expect(nextDateStr("2026-09-24")).toBe("2026-09-25");
    expect(nextDateStr("2026-09-30")).toBe("2026-10-01");
    expect(nextDateStr("2026-12-31")).toBe("2027-01-01");
  });
});

describe("seriesIdsOnDay", () => {
  it("collects the series already planned that day", async () => {
    const ids = await seriesIdsOnDay(
      "2026-09-25",
      respond(200, { activities: [{ id: "a" }, { id: "b" }, {}] }),
    );
    expect(ids && [...ids].sort()).toEqual(["a", "b"]);
  });

  it("returns null when the day can't be read", async () => {
    expect(await seriesIdsOnDay("2026-09-25", respond(500, {}))).toBeNull();
    const boom = (async () => {
      throw new Error("offline");
    }) as unknown as typeof fetch;
    expect(await seriesIdsOnDay("2026-09-25", boom)).toBeNull();
  });
});
