import {
  ArrowRight,
  Check,
  Pencil,
  Plus,
  RefreshCw,
  Sparkles,
  X,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { catClasses } from "@/lib/mock";

/* Design reference for the three AI co-planner surfaces (Phase 4).
   Contract: AI output is ALWAYS a proposal — per-item accept/reject,
   nothing mutates without explicit confirmation (ADR-005 §5). */

function SectionLabel({ n, title, sub }: { n: string; title: string; sub: string }) {
  return (
    <header className="mb-4 mt-12 first:mt-0">
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink-faint">
        Reference {n}
      </p>
      <h2 className="font-display text-2xl font-bold tracking-tight">{title}</h2>
      <p className="mt-1 text-[14px] text-ink-soft">{sub}</p>
    </header>
  );
}

const suggestedSteps = [
  { label: "Find passport photo requirements", accepted: true },
  { label: "Take photos at pharmacy booth", accepted: true },
  { label: "Fill out DS-82 form online", accepted: true },
  { label: "Write check for renewal fee", accepted: false },
  { label: "Mail at post office", accepted: true },
];

const proposal = [
  { emoji: "🛂", title: "Renew passport — first step", time: "14:45", dur: "20 min", category: "sky" as const, accepted: true },
  { emoji: "✉️", title: "Reply to Santos email", time: "15:35", dur: "15 min", category: "rose" as const, accepted: true },
  { emoji: "🐈", title: "Order cat food", time: "16:15", dur: "10 min", category: "butter" as const, accepted: false },
];

const shifts = [
  { emoji: "💊", title: "Pharmacy shift prep", from: "13:30", to: "14:10", accepted: true },
  { emoji: "📞", title: "Call Sahar", from: "15:00", to: "15:40", accepted: true },
  { emoji: "🏋️", title: "Gym — push day", from: "17:00", to: "17:00", note: "unchanged — still fits", accepted: true },
];

export default function PlannerPage() {
  return (
    <AppShell active="today">
      <div className="mx-auto max-w-2xl px-4 py-8 md:px-8">
        <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-iris-soft px-3 py-1 text-[13px] font-bold text-iris">
          <Sparkles size={14} />
          AI co-planner — design reference
        </div>
        <p className="text-[14px] leading-relaxed text-ink-soft">
          Three surfaces, one rule: the AI proposes, you decide. Every
          suggestion is a chip you accept or dismiss — nothing lands on your
          timeline by itself.
        </p>

        {/* 1 — Break it down */}
        <SectionLabel
          n="1"
          title="Break it down"
          sub="From the editor or any task: vague thing in, doable steps out."
        />
        <div className="rounded-3xl border border-border bg-surface p-5 shadow-card">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-cat-sky text-lg">
              🛂
            </span>
            <div>
              <p className="text-[15px] font-semibold">Renew passport</p>
              <p className="text-[12.5px] text-ink-soft">
                Breaking into small steps…
              </p>
            </div>
            <button className="ml-auto inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-[13px] font-semibold text-ink-soft hover:text-ink">
              <RefreshCw size={13} />
              Try again
            </button>
          </div>
          <ul className="mt-4 space-y-1.5">
            {suggestedSteps.map((s) => (
              <li
                key={s.label}
                className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 transition-colors ${
                  s.accepted
                    ? "border-iris/40 bg-iris-ghost"
                    : "border-border bg-surface opacity-60"
                }`}
              >
                <button
                  aria-label={s.accepted ? "Remove step" : "Keep step"}
                  className={`grid size-5 shrink-0 place-items-center rounded-full ${
                    s.accepted
                      ? "bg-iris text-ink-inverse"
                      : "border-2 border-border-strong"
                  }`}
                >
                  {s.accepted && <Check size={12} strokeWidth={3} />}
                </button>
                <span
                  className={`flex-1 text-[14px] font-medium ${
                    s.accepted ? "" : "line-through"
                  }`}
                >
                  {s.label}
                </span>
                <button aria-label="Edit step" className="text-ink-faint hover:text-ink">
                  <Pencil size={13} />
                </button>
              </li>
            ))}
            <li>
              <button className="flex w-full items-center gap-2 rounded-xl border border-dashed border-border-strong px-3 py-2.5 text-[13px] font-semibold text-ink-soft hover:text-ink">
                <Plus size={14} />
                Add your own step
              </button>
            </li>
          </ul>
          <div className="mt-4 flex items-center justify-between">
            <p className="text-[12.5px] text-ink-soft">
              4 of 5 steps selected · ~25 min total
            </p>
            <button className="rounded-xl bg-iris px-5 py-2.5 text-[14px] font-semibold text-ink-inverse shadow-card hover:bg-iris-deep">
              Add 4 steps
            </button>
          </div>
        </div>

        {/* 2 — Plan my day */}
        <SectionLabel
          n="2"
          title="Plan my day"
          sub="Anytime + inbox tasks placed into real gaps, tuned to your energy."
        />
        <div className="rounded-3xl border border-border bg-surface p-5 shadow-card">
          <p className="rounded-2xl bg-iris-ghost px-4 py-3 text-[14px] leading-relaxed text-ink">
            You have <strong>2 h 10 min</strong> free this afternoon and your
            energy is <strong>medium</strong>. Here&apos;s a gentle way to use it —
            take what works, leave the rest.
          </p>
          <ul className="mt-4 space-y-2">
            {proposal.map((p) => {
              const cat = catClasses[p.category];
              return (
                <li
                  key={p.title}
                  className={`flex items-center gap-3 rounded-2xl px-3.5 py-3 ${cat.fill} ${
                    p.accepted ? "" : "opacity-45 saturate-50"
                  }`}
                >
                  <span className="grid size-9 place-items-center rounded-full bg-surface-raised/80 text-base">
                    {p.emoji}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={`truncate text-[14px] font-semibold ${cat.ink}`}>
                      {p.title}
                    </p>
                    <p className={`tnum text-[12px] font-medium ${cat.ink} opacity-70`}>
                      {p.time} · {p.dur}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    <button
                      aria-label="Accept placement"
                      className={`grid size-8 place-items-center rounded-full ${
                        p.accepted
                          ? "bg-success text-ink-inverse"
                          : `border-2 border-current opacity-50 ${cat.ink}`
                      }`}
                    >
                      <Check size={15} strokeWidth={3} />
                    </button>
                    <button
                      aria-label="Dismiss placement"
                      className={`grid size-8 place-items-center rounded-full border-2 border-current opacity-40 hover:opacity-100 ${cat.ink}`}
                    >
                      <X size={14} strokeWidth={3} />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="mt-4 flex items-center justify-between">
            <button className="text-[13px] font-semibold text-ink-soft hover:text-ink">
              Shuffle the plan
            </button>
            <button className="rounded-xl bg-iris px-5 py-2.5 text-[14px] font-semibold text-ink-inverse shadow-card hover:bg-iris-deep">
              Schedule 2 accepted
            </button>
          </div>
        </div>

        {/* 3 — Disruption re-plan */}
        <SectionLabel
          n="3"
          title="Running late"
          sub="Life happened. One tap reshapes the rest of the day — with your sign-off."
        />
        <div className="rounded-3xl border border-border bg-surface p-5 shadow-card">
          <div className="flex items-center gap-3 rounded-2xl border border-now/30 bg-now/10 px-4 py-3">
            <span className="text-lg" aria-hidden>
              ⏱️
            </span>
            <p className="text-[14px] font-semibold">
              &ldquo;I&apos;m running about 40 minutes behind&rdquo;
            </p>
          </div>
          <ul className="mt-4 space-y-1.5">
            {shifts.map((s) => (
              <li
                key={s.title}
                className="flex items-center gap-3 rounded-xl border border-border bg-surface-raised px-3.5 py-2.5"
              >
                <span className="text-base" aria-hidden>
                  {s.emoji}
                </span>
                <p className="min-w-0 flex-1 truncate text-[14px] font-semibold">
                  {s.title}
                </p>
                {s.note ? (
                  <span className="text-[12px] font-medium text-ink-soft">{s.note}</span>
                ) : (
                  <span className="tnum flex items-center gap-1.5 text-[13px] font-semibold">
                    <span className="text-ink-faint line-through">{s.from}</span>
                    <ArrowRight size={12} className="text-iris" />
                    <span className="text-iris">{s.to}</span>
                  </span>
                )}
                <button
                  aria-label="Accept shift"
                  className="grid size-7 shrink-0 place-items-center rounded-full bg-success text-ink-inverse"
                >
                  <Check size={13} strokeWidth={3} />
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex items-center justify-between">
            <p className="text-[12.5px] text-ink-soft">
              Call Sahar still ends before the gym. Nothing is dropped.
            </p>
            <button className="rounded-xl bg-iris px-5 py-2.5 text-[14px] font-semibold text-ink-inverse shadow-card hover:bg-iris-deep">
              Apply 3 changes
            </button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
