import {
  ArrowRight,
  CalendarPlus,
  Flag,
  Plus,
  Sparkles,
  Sun,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { catClasses, inboxItems as mockInboxItems } from "@/lib/mock";
import { getSession } from "@/server/auth-session";
import { listTasks, listCategories } from "@/server/dal";
import { buildCategoryMap } from "@/lib/adapters";

const filters = ["All", "#errands", "#work", "#home", "#health", "#family"];

/** Load real inbox tasks or fall back to mock data when logged out. */
async function loadInbox() {
  const session = await getSession();
  if (!session) return mockInboxItems;
  const tasks = await listTasks(session.userId, { bucket: "inbox" });
  const categories = await listCategories(session.userId).catch(() => []);
  const categoryMap = buildCategoryMap(
    categories as unknown as Parameters<typeof buildCategoryMap>[0],
  );
  return tasks.map((t) => ({
    id: t.id,
    title: t.title,
    emoji: t.emoji ?? "📋",
    category: t.categoryId
      ? categoryMap.get(t.categoryId) ?? "sky"
      : "sky",
    tags: [] as string[],
    priority: (t.priority ?? "none") as "none" | "low" | "high",
  }));
}

function PriorityFlag({ level }: { level: "none" | "low" | "high" }) {
  if (level === "none") return null;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-lg px-1.5 py-0.5 text-[11px] font-bold ${
        level === "high"
          ? "bg-danger-soft text-danger"
          : "bg-surface-sunken text-ink-soft"
      }`}
    >
      <Flag size={11} fill="currentColor" />
      {level === "high" ? "High" : "Low"}
    </span>
  );
}

export default async function InboxPage() {
  const inboxItems = await loadInbox();
  return (
    <AppShell active="inbox">
      <div className="mx-auto max-w-2xl px-4 py-6 md:px-8">
        <header className="mb-1 flex items-center justify-between">
          <h1 className="font-display text-3xl font-bold tracking-tight">
            Inbox
          </h1>
          <span className="rounded-full bg-iris-soft px-2.5 py-1 text-[13px] font-bold text-iris">
            {inboxItems.length}
          </span>
        </header>
        <p className="text-[14px] text-ink-soft">
          Brain dump — no dates, no deadlines, no pressure. Nothing here ever
          turns red.
        </p>

        {/* quick add */}
        <div className="mt-5 flex items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-3 shadow-card focus-within:ring-2 focus-within:ring-iris">
          <Plus size={18} className="shrink-0 text-ink-faint" />
          <input
            className="w-full bg-transparent text-[15px] font-medium outline-none placeholder:text-ink-faint"
            placeholder="Get it out of your head…"
          />
          <kbd className="shrink-0 rounded-md bg-surface-sunken px-1.5 py-0.5 text-[11px] font-semibold text-ink-faint">
            ⏎
          </kbd>
        </div>

        {/* filters + AI grouping */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {filters.map((f, i) => (
            <button
              key={f}
              className={`rounded-full px-3 py-1.5 text-[13px] font-semibold transition-colors ${
                i === 0
                  ? "bg-ink text-ink-inverse"
                  : "border border-border bg-surface text-ink-soft hover:text-ink"
              }`}
            >
              {f}
            </button>
          ))}
          <button className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-[13px] font-semibold text-iris transition-colors hover:bg-iris-ghost">
            <Sparkles size={14} />
            Group by priority
          </button>
        </div>

        {/* list */}
        <ul className="mt-4 space-y-2">
          {inboxItems.map((t) => {
            const cat = catClasses[t.category];
            return (
              <li
                key={t.id}
                className="group flex items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-3 shadow-card transition-all hover:-translate-y-px hover:shadow-float"
              >
                <button
                  aria-label="Complete"
                  className="grid size-6 shrink-0 place-items-center rounded-full border-2 border-border-strong transition-colors hover:border-success"
                />
                <span
                  className={`grid size-9 shrink-0 place-items-center rounded-xl text-base ${cat.fill}`}
                  aria-hidden
                >
                  {t.emoji}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold">{t.title}</p>
                  <div className="mt-0.5 flex items-center gap-1.5">
                    {t.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-md bg-surface-sunken px-1.5 py-0.5 text-[11px] font-semibold text-ink-soft"
                      >
                        #{tag}
                      </span>
                    ))}
                    <PriorityFlag level={t.priority} />
                  </div>
                </div>
                {/* hover actions */}
                <div className="flex shrink-0 items-center gap-1.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                  <button
                    className="inline-flex items-center gap-1 rounded-xl bg-iris-soft px-2.5 py-1.5 text-[12px] font-semibold text-iris"
                    title="Move to today's Anytime list"
                  >
                    <Sun size={13} />
                    Anytime
                  </button>
                  <button
                    className="inline-flex items-center gap-1 rounded-xl bg-surface-sunken px-2.5 py-1.5 text-[12px] font-semibold text-ink-soft"
                    title="Pick a date and time"
                  >
                    <CalendarPlus size={13} />
                    Schedule
                  </button>
                </div>
              </li>
            );
          })}
        </ul>

        {/* empty-state reference (shown when list is empty) */}
        <div className="mt-10 rounded-3xl border border-dashed border-border-strong bg-surface p-8 text-center">
          <p className="text-3xl" aria-hidden>
            🍃
          </p>
          <p className="mt-2 font-display text-lg font-bold">Empty head, full heart</p>
          <p className="mx-auto mt-1 max-w-xs text-[13.5px] leading-relaxed text-ink-soft">
            When something pops into your mind, drop it here and let it go.
            You&apos;ll deal with it when you&apos;re ready.
          </p>
          <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-faint">
            ↑ empty-state design reference
          </p>
        </div>

        <p className="mt-6 flex items-center gap-2 text-[13px] text-ink-soft">
          <ArrowRight size={14} className="text-iris" />
          Items promoted via <strong>Anytime</strong> appear in Today&apos;s right
          rail; <strong>Schedule</strong> opens the editor with date/time focus.
        </p>
      </div>
    </AppShell>
  );
}
