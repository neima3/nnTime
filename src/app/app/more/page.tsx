import Link from "next/link";
import {
  BarChart3,
  ChevronRight,
  LayoutTemplate,
  Repeat,
  Settings,
  Sparkles,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";

/* Mobile 5th-tab destination: everything that doesn't earn a bottom tab.
   On desktop these live directly in the sidebar. */

const items = [
  { href: "/app/routines", label: "Routines", hint: "Your repeatable sequences", icon: Repeat, tint: "bg-cat-lilac text-cat-lilac-ink" },
  { href: "/app/templates", label: "Templates", hint: "Ready-made routines by Kairo", icon: LayoutTemplate, tint: "bg-cat-butter text-cat-butter-ink" },
  { href: "/app/stats", label: "Stats", hint: "Your week in a gentle mirror", icon: BarChart3, tint: "bg-cat-mint text-cat-mint-ink" },
  { href: "/app/planner", label: "AI co-planner", hint: "Break down, plan, re-plan", icon: Sparkles, tint: "bg-iris-soft text-iris" },
  { href: "/app/review", label: "Review today", hint: "Let go, move, or complete leftovers", icon: Sparkles, tint: "bg-cat-peach text-cat-peach-ink" },
  { href: "/app/settings", label: "Settings", hint: "Account, appearance, notifications", icon: Settings, tint: "bg-cat-sky text-cat-sky-ink" },
  { href: "/onboarding", label: "Onboarding", hint: "Gentle setup if you want a reset", icon: LayoutTemplate, tint: "bg-surface-sunken text-ink-soft" },
];

export default function MorePage() {
  return (
    <AppShell active="more">
      <div className="mx-auto max-w-lg px-4 py-6 md:px-8">
        <header className="mb-5">
          <h1 className="font-display text-3xl font-bold tracking-tight">More</h1>
        </header>
        <ul className="space-y-2">
          {items.map(({ href, label, hint, icon: Icon, tint }) => (
            <li key={href}>
              <Link
                href={href}
                className="flex items-center gap-4 rounded-3xl border border-border bg-surface px-4 py-4 shadow-card transition-all hover:-translate-y-px hover:shadow-float"
              >
                <span className={`grid size-11 place-items-center rounded-2xl ${tint}`}>
                  <Icon size={20} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-semibold">{label}</span>
                  <span className="block text-[12.5px] text-ink-soft">{hint}</span>
                </span>
                <ChevronRight size={18} className="text-ink-faint" />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </AppShell>
  );
}
