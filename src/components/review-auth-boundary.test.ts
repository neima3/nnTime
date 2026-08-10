import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function reviewSource() {
  return readFileSync(
    resolve(process.cwd(), "src/components/ReviewClient.tsx"),
    "utf8",
  );
}

describe("Review Today authentication boundary", () => {
  it("offers explicit auth paths instead of disabled signed-out decisions", () => {
    const source = reviewSource();

    expect(source).toContain('authPageHref("sign-in", "/app/review")');
    expect(source).toContain('authPageHref("sign-up", "/app/review")');
    expect(source).toContain("Review privately when you’re ready");
    expect(source).toContain("Sign in to review");
    expect(source).toContain("focus-visible:ring-offset-surface");
    expect(source).toContain('authed ? "Review today" : "Sample planner"');
    expect(source).toContain("!authed && (");
    expect(source).toContain("Sample activity");
    expect(source).toContain('"A review with Kairo"');
    expect(source).toContain("`${remaining} ${remaining === 1");
    expect(source).toContain(
      '<div aria-hidden="true" className="mt-5 flex items-center gap-2">',
    );
    expect(source).not.toContain('role="status"');
    expect(source).not.toContain("disabled={busy || !authed}");
    expect(source).not.toContain('href="/sign-in"');
  });

  it("retains every authenticated Review Today decision", () => {
    const source = reviewSource();

    expect(source).toContain('void act("tomorrow")');
    expect(source).toContain('void act("skip")');
    expect(source).toContain("sendRebasedStatusChange({");
    expect(source).toContain('method: "PATCH"');
    expect(source).toContain('const accepted = await act("complete")');
    expect(source).toContain("if (accepted) celebrate");
  });
});
