import type { Metadata } from "next";
import { AuthForm } from "@/components/AuthForm";
import {
  getGoogleAuthRedirectError,
  type AuthRedirectSearchParams,
} from "@/lib/auth-redirect-error";
import { getAuthCapabilities } from "@/server/auth-capabilities";

export const metadata: Metadata = { title: "Create your planner · Kairo" };

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<AuthRedirectSearchParams>;
}) {
  const initialError = getGoogleAuthRedirectError(await searchParams);

  return (
    <AuthForm
      mode="sign-up"
      capabilities={getAuthCapabilities(process.env)}
      initialError={initialError}
    />
  );
}
