import type { Metadata } from "next";
import { AuthForm } from "@/components/AuthForm";
import { getAuthCapabilities } from "@/server/auth-capabilities";

export const metadata: Metadata = { title: "Sign in · Kairo" };

export default function SignInPage() {
  return (
    <AuthForm
      mode="sign-in"
      capabilities={getAuthCapabilities(process.env)}
    />
  );
}
