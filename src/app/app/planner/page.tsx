import Link from "next/link";
import { Sparkles } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { SignedInOnly } from "@/components/AppSessionBoundary";
import { SignedOutCard } from "@/components/EmptyState";
import { PlanDayClient } from "@/components/PlanDayClient";

export default function PlannerPage() {
  return (
    <AppShell active="today">
      <SignedInOnly
        fallback={
          <div className="mx-auto max-w-2xl px-4 py-10 md:px-8">
            <SignedOutCard
              icon={Sparkles}
              title="Plan with Kairo after you sign in"
              body="Turn your real Inbox into a gentle day plan while keeping every suggestion under your control."
              headingLevel="h1"
            />
          </div>
        }
      >
        <div className="mx-auto max-w-2xl space-y-8 px-4 py-8 md:px-8">
          <header>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-iris-soft px-3 py-1 text-[13px] font-bold text-iris">
              <Sparkles size={14} />
              AI co-planner
            </div>
            <h1 className="font-display text-3xl font-bold tracking-tight">
              Gentle planning help
            </h1>
            <p className="mt-2 text-[14px] leading-relaxed text-ink-soft">
              One rule: the AI proposes, you decide. Suggestions open the editor —
              nothing mutates without your confirmation.
            </p>
          </header>

          <PlanDayClient />

          <section className="rounded-3xl border border-dashed border-border bg-surface/60 p-5">
            <h2 className="font-display text-lg font-bold">Break it down</h2>
            <p className="mt-1 text-[14px] text-ink-soft">
              From any activity editor, use{" "}
              <strong className="text-ink">Break it down</strong> to turn a vague
              title into checklist steps.
            </p>
            <Link
              href="/app/editor"
              className="mt-4 inline-flex rounded-xl bg-iris-soft px-4 py-2 text-[13px] font-semibold text-iris"
            >
              Open editor
            </Link>
          </section>
        </div>
      </SignedInOnly>
    </AppShell>
  );
}
