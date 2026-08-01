import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

import ResetPasswordPage from "./page";

describe("reset password recovery states", () => {
  it.each([undefined, "", "   ", ["first", "second"]])(
    "renders an unavailable-link state for an unusable token %#",
    async (token) => {
      const page = await ResetPasswordPage({
        searchParams: Promise.resolve({ token }),
      });
      const html = renderToStaticMarkup(page);

      expect(html).toContain("This reset link isn’t available");
      expect(html).toContain('href="/forgot-password"');
      expect(html).not.toContain("Choose a new password");
      expect(html).not.toContain('type="password"');
    },
  );

  it("keeps a usable token on the password form", async () => {
    const page = await ResetPasswordPage({
      searchParams: Promise.resolve({ token: " single-use-token " }),
    });
    const html = renderToStaticMarkup(page);

    expect(html).toContain("Choose a new password");
    expect(html).toContain('type="password"');
    expect(html).not.toContain("This reset link isn’t available");
  });

  it("keeps every reset state inside the branded auth shell", async () => {
    const page = await ResetPasswordPage({ searchParams: Promise.resolve({}) });
    const html = renderToStaticMarkup(page);

    expect(html).toContain('href="/"');
    expect(html).toContain(">Kairo</span>");
  });

  it("resolves the reset token before mounting the interactive form", () => {
    const pageSource = readFileSync(resolve(__dirname, "page.tsx"), "utf8");
    const clientPath = resolve(__dirname, "ResetPasswordForm.tsx");

    expect(pageSource).not.toContain('"use client"');
    expect(pageSource).not.toContain("useSearchParams");
    expect(pageSource).toContain("searchParams: Promise");
    expect(existsSync(clientPath)).toBe(true);
  });

  it("keeps reset credentials out of indexes with a specific title", () => {
    const pageSource = readFileSync(resolve(__dirname, "page.tsx"), "utf8");

    expect(pageSource).toContain('title: "Choose a new password · Kairo"');
    expect(pageSource).toContain("index: false");
    expect(pageSource).toContain("follow: false");
  });
});
