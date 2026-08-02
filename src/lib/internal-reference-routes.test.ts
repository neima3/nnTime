import { describe, expect, it } from "vitest";
import { shouldExposeInternalReferenceRoute } from "./internal-reference-routes";

describe("internal reference route visibility", () => {
  it("exposes references outside production only", () => {
    expect(shouldExposeInternalReferenceRoute("development")).toBe(true);
    expect(shouldExposeInternalReferenceRoute("test")).toBe(true);
    expect(shouldExposeInternalReferenceRoute("production")).toBe(false);
  });
});
