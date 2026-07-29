import type { Metadata } from "next";
import { AuthForm } from "@/components/AuthForm";
import { getAuthCapabilities } from "@/server/auth-capabilities";

export const metadata: Metadata = { title: "Create your planner · Kairo" };

export default function SignUpPage() {
  return (
    <AuthForm
      mode="sign-up"
      capabilities={getAuthCapabilities(process.env)}
    />
  );
}
