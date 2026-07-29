import { authClient, signIn } from "@/lib/auth-client";
import {
  loadConnectedProviders,
  startGoogleLink,
  startGoogleSignIn,
} from "./google-auth-flow";

type GoogleSignInInput = Omit<
  Parameters<typeof startGoogleSignIn>[0],
  "invoke"
>;
type GoogleLinkInput = Omit<Parameters<typeof startGoogleLink>[0], "invoke">;

export function signInWithGoogle(input: GoogleSignInInput): Promise<void> {
  return startGoogleSignIn({
    ...input,
    invoke: (options) => signIn.social(options),
  });
}

export function loadSettingsConnectedProviders({
  authenticated,
  settingsReady,
}: {
  authenticated: boolean;
  settingsReady: boolean;
}): Promise<Set<string> | null> {
  if (!authenticated || !settingsReady) {
    return Promise.resolve(null);
  }

  return loadConnectedProviders(() => authClient.listAccounts());
}

export type SettingsMethodsResult = {
  providers: Set<string>;
  googleAvailable: boolean;
};

export type SettingsMethodsState =
  | { status: "loading" }
  | ({ status: "ready" } & SettingsMethodsResult)
  | { status: "error" };

export function createSettingsMethodsController({
  load,
  onState,
}: {
  load: (signal: AbortSignal) => Promise<SettingsMethodsResult>;
  onState: (state: SettingsMethodsState) => void;
}) {
  let generation = 0;
  let activeRequest: AbortController | null = null;
  let disposed = false;

  return {
    async run(): Promise<void> {
      if (disposed) return;

      const requestGeneration = ++generation;
      activeRequest?.abort();
      const request = new AbortController();
      activeRequest = request;
      onState({ status: "loading" });

      try {
        const result = await load(request.signal);
        if (
          disposed ||
          request.signal.aborted ||
          requestGeneration !== generation
        ) {
          return;
        }
        onState({ status: "ready", ...result });
      } catch {
        if (
          disposed ||
          request.signal.aborted ||
          requestGeneration !== generation
        ) {
          return;
        }
        onState({ status: "error" });
      }
    },
    dispose(): void {
      disposed = true;
      generation += 1;
      activeRequest?.abort();
      activeRequest = null;
    },
  };
}

export function linkGoogleFromSettings(input: GoogleLinkInput): Promise<void> {
  return startGoogleLink({
    ...input,
    invoke: (options) => authClient.linkSocial(options),
  });
}
