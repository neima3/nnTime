import { Sparkles } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { InboxClient, type InboxItem } from "@/components/InboxClient";
import { inboxItems as mockInboxItems } from "@/lib/mock";
import { getSession } from "@/server/auth-session";
import { listTasks, listCategories } from "@/server/dal";
import { buildCategoryMap } from "@/lib/adapters";

const filters = ["All", "#errands", "#work", "#home", "#health", "#family"];

/** Load real inbox tasks or fall back to mock data when logged out. */
async function loadInbox(): Promise<{ items: InboxItem[]; authed: boolean }> {
  const session = await getSession();
  if (!session) {
    return {
      items: mockInboxItems.map((t) => ({
        id: t.id,
        title: t.title,
        emoji: t.emoji,
        category: t.category,
        tags: t.tags ?? [],
        priority: t.priority,
        revision: 1,
      })),
      authed: false,
    };
  }
  const tasks = await listTasks(session.userId, { bucket: "inbox" });
  const categories = await listCategories(session.userId).catch(() => []);
  const categoryMap = buildCategoryMap(
    categories as unknown as Parameters<typeof buildCategoryMap>[0],
  );
  return {
    authed: true,
    items: tasks.map((t) => ({
      id: t.id,
      title: t.title,
      emoji: t.emoji ?? "📋",
      category: (t.categoryId
        ? categoryMap.get(t.categoryId) ?? "sky"
        : "sky") as InboxItem["category"],
      tags: [] as string[],
      priority: (t.priority ?? "none") as "none" | "low" | "high",
      revision: t.revision,
    })),
  };
}

export default async function InboxPage() {
  const { items, authed } = await loadInbox();
  return (
    <AppShell active="inbox">
      <div className="mx-auto max-w-2xl px-4 py-6 md:px-8">
        <header className="mb-1 flex items-center justify-between">
          <h1 className="font-display text-3xl font-bold tracking-tight">
            Inbox
          </h1>
          <span className="rounded-full bg-iris-soft px-2.5 py-1 text-[13px] font-bold text-iris">
            {items.length}
          </span>
        </header>
        <p className="text-[14px] text-ink-soft">
          Brain dump — no dates, no deadlines, no pressure. Nothing here ever
          turns red.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {filters.map((f, i) => (
            <button
              key={f}
              type="button"
              className={`rounded-full px-3 py-1.5 text-[13px] font-semibold transition-colors ${
                i === 0
                  ? "bg-ink text-ink-inverse"
                  : "border border-border bg-surface text-ink-soft hover:text-ink"
              }`}
            >
              {f}
            </button>
          ))}
          <button
            type="button"
            disabled
            title="AI grouping lands in Phase 14"
            className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-[13px] font-semibold text-iris opacity-60"
          >
            <Sparkles size={14} />
            Group by priority
          </button>
        </div>

        <InboxClient initialItems={items} authed={authed} />
      </div>
    </AppShell>
  );
}
