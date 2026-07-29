import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  signInSocial: vi.fn(),
  listAccounts: vi.fn(),
  linkSocial: vi.fn(),
}));

vi.mock("@/lib/auth-client", () => ({
  signIn: {
    social: authMocks.signInSocial,
  },
  authClient: {
    listAccounts: authMocks.listAccounts,
    linkSocial: authMocks.linkSocial,
  },
}));

import {
  linkGoogleFromSettings,
  loadSettingsConnectedProviders,
  signInWithGoogle,
} from "./google-auth-integration";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("concrete Google auth client integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.signInSocial.mockResolvedValue({ error: null });
    authMocks.listAccounts.mockResolvedValue({ data: [], error: null });
    authMocks.linkSocial.mockResolvedValue({ error: null });
  });

  it.each(["sign-in", "sign-up"] as const)(
    "binds the %s card to Better Auth signIn.social",
    async (mode) => {
      await signInWithGoogle({
        mode,
        lock: { current: false },
        setPending: vi.fn(),
        setError: vi.fn(),
      });

      expect(authMocks.signInSocial).toHaveBeenCalledOnce();
      expect(authMocks.signInSocial).toHaveBeenCalledWith({
        provider: "google",
        callbackURL: "/app/today",
        errorCallbackURL: `/${mode}?provider=google`,
      });
    },
  );

  it("keeps AuthForm on the tested Better Auth adapter", () => {
    const authForm = source("src/components/AuthForm.tsx");

    expect(authForm).toContain("signInWithGoogle({");
    expect(authForm).not.toContain("signIn.social(");
  });
});

describe("concrete Settings account integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.listAccounts.mockResolvedValue({
      data: [{ providerId: "credential" }, { providerId: "google" }],
      error: null,
    });
    authMocks.linkSocial.mockResolvedValue({ error: null });
  });

  it.each([
    { authenticated: false, settingsReady: false },
    { authenticated: false, settingsReady: true },
    { authenticated: true, settingsReady: false },
  ])(
    "does not list accounts before authenticated settings are ready: %#",
    async (state) => {
      const providers = await loadSettingsConnectedProviders(state);

      expect(providers).toBeNull();
      expect(authMocks.listAccounts).not.toHaveBeenCalled();
    },
  );

  it("loads linked accounts through Better Auth after authenticated settings are ready", async () => {
    const providers = await loadSettingsConnectedProviders({
      authenticated: true,
      settingsReady: true,
    });

    expect(authMocks.listAccounts).toHaveBeenCalledOnce();
    expect(providers).toEqual(new Set(["credential", "google"]));
  });

  it("binds explicit Google linking to Better Auth linkSocial", async () => {
    await linkGoogleFromSettings({
      lock: { current: false },
      setPending: vi.fn(),
      setError: vi.fn(),
    });

    expect(authMocks.linkSocial).toHaveBeenCalledOnce();
    expect(authMocks.linkSocial).toHaveBeenCalledWith({
      provider: "google",
      callbackURL: "/app/settings?provider=google-linked",
      errorCallbackURL: "/app/settings?provider=google",
    });
  });

  it("keeps SettingsClient on the tested account controller", () => {
    const settings = source("src/components/SettingsClient.tsx");

    expect(settings).toContain("loadSettingsConnectedProviders({");
    expect(settings).toContain("linkGoogleFromSettings({");
    expect(settings).not.toContain("authClient.listAccounts(");
    expect(settings).not.toContain("authClient.linkSocial(");
  });
});
