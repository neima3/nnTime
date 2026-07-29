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

export function linkGoogleFromSettings(input: GoogleLinkInput): Promise<void> {
  return startGoogleLink({
    ...input,
    invoke: (options) => authClient.linkSocial(options),
  });
}
