import { auth } from "@/server/auth";
import { errorResponse, handleErrors, parseBody } from "@/server/api-errors";
import { getAuthCapabilities } from "@/server/auth-capabilities";
import { requireSession } from "@/server/auth-session";
import {
  exchangeAppleCredential,
  NativeAppleAuthError,
  postgresAppleChallengeStore,
} from "@/server/native-apple-auth";
import { appleExchangeRequest } from "@/server/schemas";
import { enforceNativeMutationOrigin } from "@/server/native-mutation-origin";

async function normalizeProviderResponse(
  response: Response,
): Promise<Response> {
  if (response.ok) return response;

  const body = await response.clone().json().catch(() => null) as
    | {
        code?: string;
        message?: string;
        error?: { code?: string; message?: string };
      }
    | null;
  const providerCode = body?.code ?? body?.error?.code;
  const providerMessage = body?.message ?? body?.error?.message;
  if (
    providerCode === "OAUTH_LINK_ERROR" &&
    providerMessage === "account not linked"
  ) {
    return errorResponse(
      "account_not_linked",
      "Sign in with your existing email first, then connect Apple in Settings.",
      409,
    );
  }

  return errorResponse(
    "invalid_credential",
    "Apple could not verify this sign-in. Please try again.",
    400,
  );
}

export async function POST(request: Request) {
  return handleErrors(async () => {
    if (!getAuthCapabilities(process.env).apple) {
      return errorResponse(
        "apple_unavailable",
        "Sign in with Apple is not available.",
        503,
      );
    }

    const body = await parseBody(request, appleExchangeRequest);
    if (body instanceof Response) return body;

    let userId: string | undefined;
    if (body.intent === "link") {
      const originBlock = enforceNativeMutationOrigin(request);
      if (originBlock) return originBlock;
      ({ userId } = await requireSession());
    }

    try {
      const providerResponse = await exchangeAppleCredential(
        {
          ...body,
          ...(userId ? { userId } : {}),
        },
        {
          store: postgresAppleChallengeStore,
          provider: {
            signIn: ({ idToken, nonce }) =>
              auth.api.signInSocial({
                body: {
                  provider: "apple",
                  idToken: {
                    token: idToken,
                    nonce,
                  },
                  requestSignUp: true,
                },
                asResponse: true,
                headers: request.headers,
              }),
            link: ({ idToken, nonce }) =>
              auth.api.linkSocialAccount({
                body: {
                  provider: "apple",
                  idToken: {
                    token: idToken,
                    nonce,
                  },
                },
                asResponse: true,
                headers: request.headers,
              }),
          },
        },
      );
      return normalizeProviderResponse(providerResponse);
    } catch (error) {
      if (error instanceof NativeAppleAuthError) {
        return errorResponse(error.code, error.message, error.status);
      }
      throw error;
    }
  });
}
