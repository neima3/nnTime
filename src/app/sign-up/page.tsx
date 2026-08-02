import type { Metadata } from "next";
import { AuthForm } from "@/components/AuthForm";
import {
  getGoogleAuthRedirectError,
  type AuthRedirectSearchParams,
} from "@/lib/auth-redirect-error";
import { safeAuthReturnTo } from "@/lib/auth-return";
import { getAuthCapabilities } from "@/server/auth-capabilities";

export const metadata: Metadata = { title: "Create your planner · Kairo" };

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<AuthRedirectSearchParams>;
}) {
  const params = await searchParams;
  const initialError = getGoogleAuthRedirectError(params);
  const returnTo = safeAuthReturnTo(params.next);

  return (
    <AuthForm
      mode="sign-up"
      capabilities={getAuthCapabilities(process.env)}
      initialError={initialError}
      returnTo={returnTo}
    />
  );
}
