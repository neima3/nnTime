import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("DayRituals partial-failure handling", () => {
  const source = read("src/components/DayRituals.tsx");

  it("only dismisses the morning ritual when every copy landed", () => {
    const start = source.indexOf("const copyYesterday = async () => {");
    const end = source.indexOf("const carryForward = async () => {");
    const copyYesterday = source.slice(start, end);
    expect(copyYesterday).toContain("if (copied === toCopy.length) {");
    expect(copyYesterday).toContain(
      'toast(`Copied ${copied} from yesterday`)',
    );
    expect(copyYesterday).toContain("didn't make it, try again");
  });

  it("only dismisses the evening ritual when everything moved", () => {
    const start = source.indexOf("const carryForward = async () => {");
    const end = source.indexOf("if (morningWindow &&");
    const carryForward = source.slice(start, end);
    expect(carryForward).toContain("if (moved === leftovers.length) {");
    // Only blocks that already ended are carried — never tonight's plan.
    expect(carryForward).toContain("for (const item of leftovers)");
    expect(carryForward).not.toContain("of unfinished");
    expect(carryForward).toContain("`Moved ${moved} to tomorrow — today is closed`");
    // Repeating blocks are let go today rather than duplicated onto tomorrow.
    expect(carryForward).toContain("seriesIdsOnDay(tomorrow)");
    expect(carryForward).toContain('status: "skipped"');
    expect(carryForward).toContain("didn't move, try again");
  });

  it("keeps dismiss inside the success branches only", () => {
    const start = source.indexOf("const copyYesterday = async () => {");
    const end = source.indexOf("if (morningWindow &&");
    const rituals = source.slice(start, end);
    // dismiss() appears once per ritual, inside its success branch.
    expect(rituals.match(/dismiss\(/g)).toHaveLength(2);
  });

  it("counts and carries only blocks whose end has passed", () => {
    expect(source).toContain("partitionReviewItems(");
    expect(source).toContain("leftovers.length > 0 && dismissed !== \"evening\"");
    expect(source).toContain("still ahead tonight stay put.");
  });
});
