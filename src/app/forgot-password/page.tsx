import { safeAuthReturnTo } from "@/lib/auth-return";
import { getAuthCapabilities } from "@/server/auth-capabilities";
import { ForgotPasswordForm } from "./ForgotPasswordForm";

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const returnTo = safeAuthReturnTo((await searchParams).next);

  return (
    <ForgotPasswordForm
      returnTo={returnTo}
      emailDeliveryAvailable={getAuthCapabilities(process.env).magicLink}
    />
  );
}
