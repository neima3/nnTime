export type AuthRedirectSearchParams = Record<
  string,
  string | string[] | undefined
>;

const ACCOUNT_CONFLICT_ERRORS = new Set([
  "account_not_linked",
  "oauth_link_error",
  "social_account_already_linked",
  "account_already_linked_to_different_user",
  "unable_to_link_account",
  "linking_not_allowed",
  "user_already_exists_use_another_email",
  "user_already_exists._use_another_email.",
]);

const PROVIDER_ERRORS = new Set([
  "access_denied",
  "email_not_found",
  "invalid_callback_request",
  "invalid_code",
  "no_code",
  "oauth_provider_not_found",
  "unable_to_get_user_info",
]);

export function getGoogleAuthRedirectError(
  searchParams: AuthRedirectSearchParams,
): string | null {
  if (
    searchParams.provider !== "google" ||
    typeof searchParams.error !== "string"
  ) {
    return null;
  }

  const code = searchParams.error.toLowerCase();
  if (ACCOUNT_CONFLICT_ERRORS.has(code)) {
    return "That Google account matches an existing Kairo account. Sign in with your existing method, then connect Google in Settings.";
  }
  if (PROVIDER_ERRORS.has(code)) {
    return "Google sign-in didn’t finish. Try again, or use another sign-in method.";
  }
  return null;
}
