import type { Metadata } from "next";
import { AuthForm } from "@/components/AuthForm";
import {
  getGoogleAuthRedirectError,
  type AuthRedirectSearchParams,
} from "@/lib/auth-redirect-error";
import { getAuthCapabilities } from "@/server/auth-capabilities";

export const metadata: Metadata = { title: "Sign in · Kairo" };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<AuthRedirectSearchParams>;
}) {
  const initialError = getGoogleAuthRedirectError(await searchParams);

  return (
    <AuthForm
      mode="sign-in"
      capabilities={getAuthCapabilities(process.env)}
      initialError={initialError}
    />
  );
}
