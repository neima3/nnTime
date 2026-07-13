import { Check, Download, Search } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { catClasses, templates } from "@/lib/mock";

/* Design reference: built-in template gallery (Phase 5D).
   Templates import as independent copies ("By Kairo" provenance kept). */

const groups = ["All", "Morning", "Work", "Study", "Home", "Evening", "Self-care"];

export default function TemplatesPage() {
  return (
    <AppShell active="templates">
      <div className="mx-auto max-w-5xl px-4 py-6 md:px-8">
        <header className="mb-6">
          <h1 className="font-display text-3xl font-bold tracking-tight">
            Templates
          </h1>
          <p className="mt-1 text-[14px] text-ink-soft">
            Ready-made routines you can take and reshape. Importing makes your
            own copy — edit anything.
          </p>
        </header>

        {/* search + groups */}
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <div className="flex min-w-56 flex-1 items-center gap-2.5 rounded-2xl border border-border bg-surface px-4 py-2.5 shadow-card focus-within:ring-2 focus-within:ring-iris sm:max-w-xs">
            <Search size={16} className="shrink-0 text-ink-faint" />
            <input
              placeholder="Search templates…"
              className="w-full bg-transparent text-[14px] font-medium outline-none placeholder:text-ink-faint"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {groups.map((g, i) => (
              <button
                key={g}
                className={`rounded-full px-3 py-1.5 text-[13px] font-semibold transition-colors ${
                  i === 0
                    ? "bg-ink text-ink-inverse"
                    : "border border-border bg-surface text-ink-soft hover:text-ink"
                }`}
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((t) => {
            const cat = catClasses[t.category];
            return (
              <article
                key={t.id}
                className="group flex flex-col rounded-3xl border border-border bg-surface p-5 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-float"
              >
                <div className="flex items-start justify-between">
                  <span
                    className={`grid size-12 place-items-center rounded-2xl text-2xl ${cat.fill}`}
                    aria-hidden
                  >
                    {t.emoji}
                  </span>
                  <span className="rounded-lg bg-surface-sunken px-2 py-1 text-[11px] font-bold text-ink-soft">
                    {t.group}
                  </span>
                </div>
                <h2 className="mt-4 font-display text-lg font-bold leading-tight">
                  {t.title}
                </h2>
                <p className="tnum mt-0.5 text-[13px] font-medium text-ink-soft">
                  {t.steps.length} steps · {t.minutes} min · By Kairo
                </p>
                <ul className="mt-3 space-y-1">
                  {t.steps.map((s) => (
                    <li
                      key={s}
                      className="flex items-center gap-2 text-[13px] font-medium text-ink-soft"
                    >
                      <Check size={13} className={cat.ink} strokeWidth={3} />
                      {s}
                    </li>
                  ))}
                </ul>
                <button className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-iris-soft py-2.5 text-[13.5px] font-semibold text-iris transition-colors group-hover:bg-iris group-hover:text-ink-inverse">
                  <Download size={15} />
                  Use template
                </button>
              </article>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}
