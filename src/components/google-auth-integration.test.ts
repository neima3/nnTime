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
  createSettingsMethodsController,
  linkGoogleFromSettings,
  loadSettingsConnectedProviders,
  signInWithGoogle,
} from "./google-auth-integration";
import {
  acquireAuthRequest,
  releaseAuthRequest,
} from "./auth-request-guard";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
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
        returnTo: "/app/inbox",
        lock: { current: false },
        setPending: vi.fn(),
        setError: vi.fn(),
      });

      expect(authMocks.signInSocial).toHaveBeenCalledOnce();
      expect(authMocks.signInSocial).toHaveBeenCalledWith({
        provider: "google",
        callbackURL: "/app/inbox",
        errorCallbackURL: `/${mode}?provider=google&next=%2Fapp%2Finbox`,
      });
    },
  );

  it("keeps AuthForm on the tested Better Auth adapter", () => {
    const authForm = source("src/components/AuthForm.tsx");

    expect(authForm).toContain("signInWithGoogle({");
    expect(authForm).not.toContain("signIn.social(");
  });

  it("blocks a Google redirect when another auth action owns the shared guard", async () => {
    const lock = { current: false };

    expect(acquireAuthRequest(lock)).toBe(true);
    await signInWithGoogle({
      mode: "sign-in",
      returnTo: "/app/inbox",
      lock,
      setPending: vi.fn(),
      setError: vi.fn(),
    });

    expect(authMocks.signInSocial).not.toHaveBeenCalled();
    releaseAuthRequest(lock);
    expect(acquireAuthRequest(lock)).toBe(true);
  });

  it("keeps every AuthForm action on one busy state and one immediate guard", () => {
    const authForm = source("src/components/AuthForm.tsx");

    expect(authForm).toContain(
      'useState<"email" | "magic" | "google" | null>(null)',
    );
    expect(authForm).toContain("const authBusy = busyAction !== null");
    expect(authForm.match(/disabled=\{authBusy\}/g)).toHaveLength(3);
    expect(authForm.match(/acquireAuthRequest\(authLock\)/g)).toHaveLength(2);
    expect(authForm).toContain("lock: authLock");
    expect(authForm).toContain("router.push(safeReturnTo)");
    expect(authForm).toContain("callbackURL: safeReturnTo");
    expect(authForm).toContain("returnTo: safeReturnTo");
    expect(authForm).not.toContain("googleLock");
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
    expect(settings).toContain("createSettingsMethodsController({");
    expect(settings).toContain("controller.dispose()");
    expect(settings).toContain("setMethodsReloadKey((key) => key + 1)");
    expect(settings).not.toContain("methodsLoadStarted");
    expect(settings).not.toContain("authClient.listAccounts(");
    expect(settings).not.toContain("authClient.linkSocial(");
  });

  it("survives Strict Mode cleanup and replay without applying the disposed result", async () => {
    const first = deferred<{
      providers: Set<string>;
      googleAvailable: boolean;
    }>();
    const second = deferred<{
      providers: Set<string>;
      googleAvailable: boolean;
    }>();
    const firstStates: string[] = [];
    const secondStates: string[] = [];
    const firstController = createSettingsMethodsController({
      load: () => first.promise,
      onState: (state) => firstStates.push(state.status),
    });
    const secondController = createSettingsMethodsController({
      load: () => second.promise,
      onState: (state) => secondStates.push(state.status),
    });

    const firstRun = firstController.run();
    firstController.dispose();
    const replayRun = secondController.run();
    first.resolve({
      providers: new Set(["stale"]),
      googleAvailable: false,
    });
    second.resolve({
      providers: new Set(["google"]),
      googleAvailable: true,
    });
    await Promise.all([firstRun, replayRun]);

    expect(firstStates).toEqual(["loading"]);
    expect(secondStates).toEqual(["loading", "ready"]);
  });

  it("aborts an older generation when dependencies trigger a new load", async () => {
    const requests = [
      deferred<{ providers: Set<string>; googleAvailable: boolean }>(),
      deferred<{ providers: Set<string>; googleAvailable: boolean }>(),
    ];
    const signals: AbortSignal[] = [];
    const states: Array<{ status: string; providers?: Set<string> }> = [];
    const controller = createSettingsMethodsController({
      load: (signal) => {
        signals.push(signal);
        return requests[signals.length - 1].promise;
      },
      onState: (state) => states.push(state),
    });

    const staleRun = controller.run();
    const currentRun = controller.run();
    requests[1].resolve({
      providers: new Set(["google"]),
      googleAvailable: true,
    });
    requests[0].resolve({
      providers: new Set(["stale"]),
      googleAvailable: false,
    });
    await Promise.all([staleRun, currentRun]);

    expect(signals[0].aborted).toBe(true);
    expect(states.filter((state) => state.status === "ready")).toEqual([
      expect.objectContaining({ providers: new Set(["google"]) }),
    ]);
  });

  it("transitions from failure through retry to a fresh result", async () => {
    const states: Array<{ status: string; providers?: Set<string> }> = [];
    const load = vi
      .fn()
      .mockRejectedValueOnce(new Error("temporary failure"))
      .mockResolvedValueOnce({
        providers: new Set(["credential"]),
        googleAvailable: true,
      });
    const controller = createSettingsMethodsController({
      load,
      onState: (state) => states.push(state),
    });

    await controller.run();
    await controller.run();

    expect(states.map((state) => state.status)).toEqual([
      "loading",
      "error",
      "loading",
      "ready",
    ]);
    expect(states.at(-1)).toEqual(
      expect.objectContaining({ providers: new Set(["credential"]) }),
    );
  });
});
