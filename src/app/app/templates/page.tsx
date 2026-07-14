import { AppShell } from "@/components/AppShell";
import { TemplatesClient } from "@/components/TemplatesClient";
import { templates as mockTemplates } from "@/lib/mock";
import { getSession } from "@/server/auth-session";

export default async function TemplatesPage() {
  const session = await getSession();
  return (
    <AppShell active="templates">
      <div className="mx-auto max-w-5xl px-4 py-6 md:px-8">
        <header className="mb-6">
          <h1 className="font-display text-3xl font-bold tracking-tight">
            Templates
          </h1>
          <p className="mt-1 text-[14px] text-ink-soft">
            Ready-made blocks you can take and reshape. Applying creates a real
            activity on Today.
          </p>
        </header>
        <TemplatesClient
          templates={mockTemplates}
          authed={Boolean(session)}
        />
      </div>
    </AppShell>
  );
}
