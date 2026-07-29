import { isValidElement, type ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { SettingsClient } from "@/components/SettingsClient";
import {
  getGoogleLinkRedirectError,
  type AuthRedirectSearchParams,
} from "@/lib/auth-redirect-error";
import SettingsPage from "./page";

function findSettingsClient(node: ReactNode): React.ReactElement | null {
  if (!isValidElement(node)) return null;
  if (node.type === SettingsClient) return node;

  const children = (
    node.props as {
      children?: ReactNode;
    }
  ).children;
  for (const child of Array.isArray(children) ? children : [children]) {
    const match = findSettingsClient(child);
    if (match) return match;
  }
  return null;
}

describe("Settings Google link recovery", () => {
  it.each([
    {
      error: "email_doesn't_match",
      expected:
        "That Google account uses a different email. Your planner is unchanged — choose the Google account that matches this Kairo account.",
    },
    {
      error: "account_already_linked_to_different_user",
      expected:
        "That Google account is already connected to another Kairo account. Your current planner is unchanged.",
    },
    {
      error: "access_denied",
      expected:
        "Google wasn’t connected. Your planner is unchanged — try again when you’re ready.",
    },
  ])("maps an exact returned $error code to fixed copy", ({ error, expected }) => {
    const message = getGoogleLinkRedirectError({
      provider: "google",
      error,
      error_description: "id_token=must-never-render",
    });

    expect(message).toBe(expected);
    expect(message).not.toContain("id_token");
  });

  it.each([
    { provider: "apple", error: "access_denied" },
    { provider: "google", error: "unknown_link_payload" },
    { provider: "google", error: ["access_denied", "invalid_code"] },
    { provider: "google-linked" },
    { provider: "google" },
  ] satisfies AuthRedirectSearchParams[])(
    "suppresses unrelated, unknown, array, and successful queries: %#",
    (query) => {
      expect(getGoogleLinkRedirectError(query)).toBeNull();
    },
  );

  it("awaits Next 16 searchParams and passes only fixed link copy to SettingsClient", async () => {
    const page = await SettingsPage({
      searchParams: Promise.resolve({
        provider: "google",
        error: "email_doesn't_match",
        error_description: "client_secret=must-never-render",
      }),
    });
    const settingsClient = findSettingsClient(page);

    expect(settingsClient?.props).toEqual(
      expect.objectContaining({
        initialLinkError:
          "That Google account uses a different email. Your planner is unchanged — choose the Google account that matches this Kairo account.",
      }),
    );
    expect(JSON.stringify(settingsClient?.props)).not.toContain("client_secret");
  });

  it("does not initialize an error after a successful Google link redirect", async () => {
    const page = await SettingsPage({
      searchParams: Promise.resolve({ provider: "google-linked" }),
    });
    const settingsClient = findSettingsClient(page);

    expect(settingsClient?.props).toEqual(
      expect.objectContaining({ initialLinkError: null }),
    );
  });
});
