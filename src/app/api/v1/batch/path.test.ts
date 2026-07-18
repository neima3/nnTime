import { describe, expect, it } from "vitest";
import { isAllowedBatchPath, normalizeBatchPath } from "./path";

describe("normalizeBatchPath", () => {
  it("strips query and hash", () => {
    expect(normalizeBatchPath("/api/v1/tasks?x=1")).toBe("/api/v1/tasks");
    expect(normalizeBatchPath("/api/v1/tasks#frag")).toBe("/api/v1/tasks");
  });

  it("collapses trailing slash except root", () => {
    expect(normalizeBatchPath("/api/v1/tasks/")).toBe("/api/v1/tasks");
    expect(normalizeBatchPath("/api/v1/tasks///")).toBe("/api/v1/tasks");
    expect(normalizeBatchPath("/")).toBe("/");
  });
});

describe("isAllowedBatchPath", () => {
  it("allows normal v1 paths", () => {
    expect(isAllowedBatchPath("/api/v1/tasks")).toBe(true);
    expect(isAllowedBatchPath("/api/v1/activities/abc")).toBe(true);
  });

  it("rejects non-v1, traversal, and double-slash", () => {
    expect(isAllowedBatchPath("/api/health")).toBe(false);
    expect(isAllowedBatchPath("/api/v1/../secret")).toBe(false);
    expect(isAllowedBatchPath("/api/v1//tasks")).toBe(false);
  });

  it("rejects recursive batch", () => {
    expect(isAllowedBatchPath("/api/v1/batch")).toBe(false);
    expect(isAllowedBatchPath("/api/v1/batch/nested")).toBe(false);
  });
});
