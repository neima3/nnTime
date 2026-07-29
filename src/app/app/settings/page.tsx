import { AppShell } from "@/components/AppShell";
import { SettingsClient } from "@/components/SettingsClient";
import {
  getGoogleLinkRedirectError,
  type AuthRedirectSearchParams,
} from "@/lib/auth-redirect-error";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<AuthRedirectSearchParams>;
}) {
  const initialLinkError = getGoogleLinkRedirectError(await searchParams);

  return (
    <AppShell active="settings">
      <div className="mx-auto max-w-2xl space-y-8 px-4 py-6 md:px-8">
        <header>
          <h1 className="font-display text-3xl font-bold tracking-tight">
            Settings
          </h1>
          <p className="mt-1 text-[14px] text-ink-soft">
            Soft Focus personalization — theme, time, and privacy.
          </p>
        </header>
        <SettingsClient initialLinkError={initialLinkError} />
      </div>
    </AppShell>
  );
}
