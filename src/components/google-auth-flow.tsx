import { Check, Link2, Loader2 } from "lucide-react";
import {
  acquireAuthRequest,
  releaseAuthRequest,
  type AuthRequestLock,
} from "./auth-request-guard";
import { authPageHref, safeAuthReturnTo } from "@/lib/auth-return";

type FlowLock = AuthRequestLock;

type ProviderResult =
  | {
      error?: unknown;
    }
  | null
  | void;

type GoogleActionOptions = {
  provider: "google";
  callbackURL: string;
  errorCallbackURL: string;
};

type GoogleActionInput = {
  invoke: (options: GoogleActionOptions) => Promise<ProviderResult>;
  lock: FlowLock;
  setPending: (pending: boolean) => void;
  setError: (error: string | null) => void;
};

const GOOGLE_SIGN_IN_ERROR =
  "Google sign-in didn’t finish. Try again, or use another sign-in method.";
const GOOGLE_LINK_ERROR =
  "Google couldn’t be connected. Your planner is unchanged — try again?";

async function runGoogleAction({
  invoke,
  lock,
  setPending,
  setError,
  options,
  errorMessage,
}: GoogleActionInput & {
  options: GoogleActionOptions;
  errorMessage: string;
}): Promise<void> {
  if (!acquireAuthRequest(lock)) {
    return;
  }

  setError(null);
  setPending(true);
  try {
    const result = await invoke(options);
    if (result?.error) {
      setError(errorMessage);
    }
  } catch {
    setError(errorMessage);
  } finally {
    releaseAuthRequest(lock);
    setPending(false);
  }
}

export function startGoogleSignIn({
  mode,
  returnTo,
  ...input
}: GoogleActionInput & {
  mode: "sign-in" | "sign-up";
  returnTo: string;
}): Promise<void> {
  const callbackURL = safeAuthReturnTo(returnTo);
  return runGoogleAction({
    ...input,
    options: {
      provider: "google",
      callbackURL,
      errorCallbackURL: authPageHref(mode, callbackURL, {
        provider: "google",
      }),
    },
    errorMessage: GOOGLE_SIGN_IN_ERROR,
  });
}

export function startGoogleLink(input: GoogleActionInput): Promise<void> {
  return runGoogleAction({
    ...input,
    options: {
      provider: "google",
      callbackURL: "/app/settings?provider=google-linked",
      errorCallbackURL: "/app/settings?provider=google",
    },
    errorMessage: GOOGLE_LINK_ERROR,
  });
}

type AccountListResult = {
  data?: Array<{ providerId?: unknown }> | null;
  error?: unknown;
};

export async function loadConnectedProviders(
  listAccounts: () => Promise<AccountListResult>,
): Promise<Set<string>> {
  const result = await listAccounts();
  if (result.error) {
    throw new Error("Could not load connected sign-in methods");
  }

  return new Set(
    (result.data ?? [])
      .map((account) => account.providerId)
      .filter((providerId): providerId is string => typeof providerId === "string"),
  );
}

type ConnectedSignInMethodsProps = {
  googleAvailable: boolean;
  connectedProviders: ReadonlySet<string>;
  loading: boolean;
  linking: boolean;
  error: string | null;
  loadError?: string | null;
  onLinkGoogle: () => void;
  onRetry?: () => void;
};

function ConnectedMethod({
  label,
  connected,
  action,
}: {
  label: string;
  connected: boolean;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-14 items-center justify-between gap-4 px-5 py-3.5">
      <div>
        <p className="text-[15px] font-semibold">{label}</p>
        <p className="mt-0.5 text-[13px] text-ink-soft">
          {connected ? "Ready for sign-in" : "Not connected"}
        </p>
      </div>
      {connected ? (
        <span className="inline-flex min-h-8 items-center gap-1.5 rounded-full bg-success-soft px-3 text-[12px] font-semibold text-success">
          <Check size={14} aria-hidden="true" />
          Connected
        </span>
      ) : (
        action
      )}
    </div>
  );
}

export function ConnectedSignInMethods({
  googleAvailable,
  connectedProviders,
  loading,
  linking,
  error,
  loadError = null,
  onLinkGoogle,
  onRetry,
}: ConnectedSignInMethodsProps) {
  const knownMethods = [
    connectedProviders.has("credential")
      ? { id: "credential", label: "Email and password" }
      : null,
    connectedProviders.has("apple") ? { id: "apple", label: "Apple" } : null,
  ].filter((method): method is { id: string; label: string } => method !== null);
  const googleConnected = connectedProviders.has("google");

  return (
    <section aria-labelledby="connected-sign-in-methods">
      <h2
        id="connected-sign-in-methods"
        className="mb-2 flex items-center gap-2 px-1 text-[13px] font-bold uppercase tracking-[0.12em] text-ink-soft"
      >
        <Link2 size={15} aria-hidden="true" />
        Connected sign-in methods
      </h2>
      <div className="divide-y divide-border overflow-hidden rounded-3xl border border-border bg-surface shadow-card">
        {loading ? (
          <p role="status" className="px-5 py-4 text-[13px] text-ink-soft">
            Checking connected methods…
          </p>
        ) : (
          <>
            {knownMethods.map((method) => (
              <ConnectedMethod
                key={method.id}
                label={method.label}
                connected
              />
            ))}
            {(googleAvailable || googleConnected) && (
              <ConnectedMethod
                label="Google"
                connected={googleConnected}
                action={
                  <button
                    type="button"
                    disabled={linking}
                    aria-busy={linking}
                    onClick={onLinkGoogle}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border bg-surface px-3.5 text-[13px] font-semibold text-ink-soft transition-colors hover:bg-surface-sunken hover:text-ink focus-visible:ring-2 focus-visible:ring-iris focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {linking ? (
                      <>
                        <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                        Connecting…
                      </>
                    ) : (
                      "Connect Google"
                    )}
                  </button>
                }
              />
            )}
            {!knownMethods.length && !googleAvailable && !googleConnected ? (
              <p className="px-5 py-4 text-[13px] text-ink-soft">
                Your current sign-in method is connected.
              </p>
            ) : null}
          </>
        )}
        {googleAvailable && !googleConnected && !loading ? (
          <p className="px-5 py-3.5 text-[13px] leading-relaxed text-ink-soft">
            Connect only when you choose. Kairo won’t merge planners or accounts
            without your action.
          </p>
        ) : null}
        {error ? (
          <p
            role="alert"
            className="bg-danger-soft px-5 py-3.5 text-[13px] font-medium text-danger"
          >
            {error}
          </p>
        ) : null}
        {loadError ? (
          <div
            role="alert"
            className="flex items-center justify-between gap-4 bg-danger-soft px-5 py-3.5"
          >
            <p className="text-[13px] font-medium text-danger">{loadError}</p>
            {onRetry ? (
              <button
                type="button"
                onClick={onRetry}
                className="min-h-11 shrink-0 rounded-xl border border-danger px-3 text-[13px] font-semibold text-danger transition-colors hover:bg-surface focus-visible:ring-2 focus-visible:ring-iris focus-visible:outline-none"
              >
                Try again
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
