import { createElement } from "react";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const navigation = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => navigation,
}));

vi.mock("@/lib/auth-client", () => ({
  signIn: {
    email: vi.fn(),
    magicLink: vi.fn(),
    social: vi.fn(),
  },
  signUp: {
    email: vi.fn(),
  },
}));

import { AuthForm } from "./AuthForm";
import {
  ConnectedSignInMethods,
  loadConnectedProviders,
  startGoogleLink,
  startGoogleSignIn,
} from "./google-auth-flow";

const unavailable = Object.freeze({
  magicLink: false,
  apple: false,
  google: false,
});
const googleAvailable = Object.freeze({
  ...unavailable,
  google: true,
});

describe("Google authentication web flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("omits Google when the provider capability is unavailable", () => {
    const html = renderToStaticMarkup(
      createElement(AuthForm, {
        mode: "sign-in",
        capabilities: unavailable,
      }),
    );

    expect(html).not.toContain("Continue with Google");
  });

  it.each(["sign-in", "sign-up"] as const)(
    "offers Google on the %s card when configured",
    (mode) => {
      const html = renderToStaticMarkup(
        createElement(AuthForm, {
          mode,
          capabilities: googleAvailable,
        }),
      );

      expect(html).toContain("Continue with Google");
      expect(html).toContain('aria-label="Continue with Google"');
      expect(html).toContain('src="/brand/google-g.png"');
      expect(html).not.toContain("lucide-globe");
    },
  );

  it("uses Google’s unmodified white-backed light square brand asset", () => {
    const asset = readFileSync(
      resolve(process.cwd(), "public/brand/google-g.png"),
    );

    expect(asset.subarray(0, 8)).toEqual(
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    );
    expect(createHash("sha256").update(asset).digest("hex")).toBe(
      "33f5ab7c3d6b6af7c8cdd3e917e4475d9a2ffd407a7667a68747140b290bdeb8",
    );
    const authFormSource = readFileSync(
      resolve(process.cwd(), "src/components/AuthForm.tsx"),
      "utf8",
    );
    expect(authFormSource).toContain('src="/brand/google-g.png"');
    expect(authFormSource).toContain("width={40}");
    expect(authFormSource).toContain("height={40}");
    expect(authFormSource).not.toContain("bg-white");
    expect(authFormSource).not.toContain("bg-surface-raised");
  });

  it("starts same-origin Google sign-in once and exposes pending state", async () => {
    let resolveFlow: ((value: { error: null }) => void) | undefined;
    const invoke = vi.fn(
      () =>
        new Promise<{ error: null }>((resolve) => {
          resolveFlow = resolve;
        }),
    );
    const pendingStates: boolean[] = [];
    const errors: Array<string | null> = [];
    const lock = { current: false };

    const first = startGoogleSignIn({
      mode: "sign-in",
      returnTo: "/app/inbox",
      invoke,
      lock,
      setPending: (pending) => pendingStates.push(pending),
      setError: (error) => errors.push(error),
    });
    const second = startGoogleSignIn({
      mode: "sign-in",
      returnTo: "/app/inbox",
      invoke,
      lock,
      setPending: (pending) => pendingStates.push(pending),
      setError: (error) => errors.push(error),
    });

    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke).toHaveBeenCalledWith({
      provider: "google",
      callbackURL: "/app/inbox",
      errorCallbackURL: "/sign-in?provider=google&next=%2Fapp%2Finbox",
    });
    expect(lock.current).toBe(true);
    expect(pendingStates).toEqual([true]);
    resolveFlow?.({ error: null });
    await Promise.all([first, second]);
    expect(lock.current).toBe(false);
    expect(pendingStates).toEqual([true, false]);
    expect(errors).toEqual([null]);
  });

  it("maps provider failures to a calm error without leaking payloads", async () => {
    const errors: Array<string | null> = [];

    await startGoogleSignIn({
      mode: "sign-up",
      returnTo: "/app/inbox",
      invoke: vi.fn().mockResolvedValue({
        error: { message: "oauth payload: client_secret=do-not-show" },
      }),
      lock: { current: false },
      setPending: vi.fn(),
      setError: (error) => errors.push(error),
    });

    expect(errors.at(-1)).toBe(
      "Google sign-in didn’t finish. Try again, or use another sign-in method.",
    );
    expect(errors.join(" ")).not.toContain("client_secret");
  });

  it("keeps sign-up provider failures on the same-origin sign-up page", async () => {
    const invoke = vi.fn().mockResolvedValue({ error: null });

    await startGoogleSignIn({
      mode: "sign-up",
      returnTo: "/app/inbox",
      invoke,
      lock: { current: false },
      setPending: vi.fn(),
      setError: vi.fn(),
    });

    expect(invoke).toHaveBeenCalledWith({
      provider: "google",
      callbackURL: "/app/inbox",
      errorCallbackURL: "/sign-up?provider=google&next=%2Fapp%2Finbox",
    });
  });

  it.each(["sign-in", "sign-up"] as const)(
    "preserves the destination in the %s mode switch",
    (mode) => {
      const html = renderToStaticMarkup(
        createElement(AuthForm, {
          mode,
          capabilities: unavailable,
          returnTo: "/app/inbox",
        }),
      );

      expect(html).toContain(
        mode === "sign-in"
          ? 'href="/sign-up?next=%2Fapp%2Finbox"'
          : 'href="/sign-in?next=%2Fapp%2Finbox"',
      );
    },
  );
});

describe("connected sign-in methods", () => {
  it("reduces the account response to connected provider IDs", async () => {
    const providers = await loadConnectedProviders(
      vi.fn().mockResolvedValue({
        data: [
          {
            providerId: "credential",
            accountId: "private-account-id",
            accessToken: "private-token",
          },
          {
            providerId: "google",
            accountId: "google-private-id",
          },
        ],
        error: null,
      }),
    );

    expect(providers).toEqual(new Set(["credential", "google"]));
    expect(JSON.stringify([...providers])).not.toContain("private-account-id");
  });

  it("shows Google as connected without a link action", () => {
    const html = renderToStaticMarkup(
      createElement(ConnectedSignInMethods, {
        googleAvailable: true,
        connectedProviders: new Set(["credential", "google"]),
        loading: false,
        linking: false,
        error: null,
        onLinkGoogle: vi.fn(),
      }),
    );

    expect(html).toContain("Connected sign-in methods");
    expect(html).toContain("Google");
    expect(html).toContain("Connected");
    expect(html).not.toContain(">Connect<");
  });

  it("offers explicit Google linking only when configured and not connected", () => {
    const html = renderToStaticMarkup(
      createElement(ConnectedSignInMethods, {
        googleAvailable: true,
        connectedProviders: new Set(["credential"]),
        loading: false,
        linking: false,
        error: null,
        onLinkGoogle: vi.fn(),
      }),
    );

    expect(html).toContain("Connect Google");
    expect(html).toContain(
      "Kairo won’t merge planners or accounts without your action.",
    );
  });

  it("starts authenticated Google linking once with same-origin callbacks", async () => {
    let resolveFlow: ((value: { error: null }) => void) | undefined;
    const invoke = vi.fn(
      () =>
        new Promise<{ error: null }>((resolve) => {
          resolveFlow = resolve;
        }),
    );
    const lock = { current: false };

    const first = startGoogleLink({
      invoke,
      lock,
      setPending: vi.fn(),
      setError: vi.fn(),
    });
    const second = startGoogleLink({
      invoke,
      lock,
      setPending: vi.fn(),
      setError: vi.fn(),
    });

    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke).toHaveBeenCalledWith({
      provider: "google",
      callbackURL: "/app/settings?provider=google-linked",
      errorCallbackURL: "/app/settings?provider=google",
    });
    resolveFlow?.({ error: null });
    await Promise.all([first, second]);
  });

  it("offers an accessible retry after connected-method loading fails", () => {
    const html = renderToStaticMarkup(
      createElement(ConnectedSignInMethods, {
        googleAvailable: false,
        connectedProviders: new Set<string>(),
        loading: false,
        linking: false,
        error: null,
        loadError: "Couldn’t load connected sign-in methods.",
        onLinkGoogle: vi.fn(),
        onRetry: vi.fn(),
      }),
    );

    expect(html).toContain('role="alert"');
    expect(html).toContain("Couldn’t load connected sign-in methods.");
    expect(html).toContain(">Try again<");
  });
});
