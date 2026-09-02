import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { partitionReviewItems } from "./review-window";

const block = (startMin: number, durationMin: number, id = `${startMin}`) => ({
  id,
  startMin,
  durationMin,
});

describe("partitionReviewItems", () => {
  it("lists only blocks whose end has passed, and counts the rest", () => {
    const items = [
      block(9 * 60, 30, "done-at-9:30"),
      block(13 * 60, 60, "running-now"),
      block(19 * 60, 45, "tonight"),
    ];
    const { past, upcoming } = partitionReviewItems(items, 13 * 60 + 20);
    expect(past.map((i) => i.id)).toEqual(["done-at-9:30"]);
    expect(upcoming).toBe(2);
  });

  it("treats a block ending exactly now as over", () => {
    const { past } = partitionReviewItems([block(10 * 60, 30)], 10 * 60 + 30);
    expect(past).toHaveLength(1);
  });

  it("reviews everything when the day is not today", () => {
    const items = [block(9 * 60, 30), block(21 * 60, 30)];
    expect(partitionReviewItems(items, null)).toEqual({ past: items, upcoming: 0 });
  });

  it("is what the Review route uses", () => {
    const page = readFileSync(
      resolve(process.cwd(), "src/app/app/review/page.tsx"),
      "utf8",
    );
    expect(page).toContain("partitionReviewItems(");
    const client = readFileSync(
      resolve(process.cwd(), "src/components/ReviewClient.tsx"),
      "utf8",
    );
    expect(client).toContain("still ahead today");
  });
});
