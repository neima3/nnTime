"use client";

/**
 * Onboarding — Phase 6A.
 *
 * Four-step flow that sets real user defaults via the DAL:
 * 1. Welcome → sign-up if not logged in
 * 2. Planning-feel quiz → sets notification preferences (reduced_stimulation,
 *    wrap-up nudges default ON, etc.)
 * 3. First routine pick → creates a routine from the templates library
 * 4. Notification opt-in → requests browser permission (user gesture required
 *    for iOS PWA push per ADR-004)
 *
 * Each step is skippable. On finish, redirects to /app/today.
 */

import { useEffect, useState } from "react";
import { ArrowRight, Bell, Check } from "lucide-react";
import { useRouter } from "next/navigation";

function StepFrame({ step, children }: { step: number; children: React.ReactNode }) {
  return (
    <section className="mx-auto w-full max-w-md">
      <p className="mb-3 text-center text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-faint">
        Step {step} of 4
      </p>
      <div className="rounded-[2rem] border border-border bg-surface p-8 shadow-float">
        <div className="mb-7 flex justify-center gap-2" aria-hidden>
          {[1, 2, 3, 4].map((i) => (
            <span
              key={i}
              className={`h-2 rounded-full transition-all ${
                i === step ? "w-6 bg-iris" : "w-2 bg-border-strong"
              }`}
            />
          ))}
        </div>
        {children}
      </div>
    </section>
  );
}

const quizOptions = [
  { id: "slip", emoji: "🌊", label: "Plans slip away from me" },
  { id: "start", emoji: "🚪", label: "Starting is the hardest part" },
  { id: "time", emoji: "⏳", label: "I lose track of time completely" },
  { id: "chaos", emoji: "🌪️", label: "Too many thoughts, no order" },
];

const templatePick = [
  { id: "tpl_morning_gentle", emoji: "🌤️", title: "Gentle morning", meta: "3 steps · 40 min" },
  { id: "tpl_work_launch", emoji: "🚀", title: "Launch into work", meta: "3 steps · 1 h" },
  { id: "tpl_soft_landing", emoji: "🌙", title: "Soft landing", meta: "3 steps · 45 min" },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [quizPicks, setQuizPicks] = useState<Set<string>>(new Set());
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Check auth on mount — redirect to sign-up if not logged in.
  useEffect(() => {
    fetch("/api/auth/get-session")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data?.user?.id) {
          router.push("/sign-up?next=/onboarding");
        }
      })
      .catch(() => {
        // Not logged in — let them see the welcome step.
      });
  }, [router]);

  const toggleQuiz = (id: string) => {
    setQuizPicks((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      // Save quiz-derived preferences via the settings endpoint.
      const prefs: Record<string, unknown> = {};
      if (quizPicks.has("time")) prefs.wrapUpNudges = true;
      if (quizPicks.has("start")) prefs.breakItDownDefault = true;
      if (quizPicks.has("chaos")) prefs.reducedStimulation = true;

      // GET current settings to get revision, then PATCH.
      const getRes = await fetch("/api/v1/settings");
      if (getRes.ok) {
        const settings = await getRes.json();
        await fetch("/api/v1/settings", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "If-Match": String(settings.revision ?? 1),
          },
          body: JSON.stringify({
            notificationPrefs: prefs,
            ...(quizPicks.has("chaos") ? { reducedStimulation: true } : {}),
          }),
        });
      }
    } catch {
      // Settings save is best-effort; onboarding continues regardless.
    }
    setSaving(false);
  };

  const saveTemplate = async () => {
    if (!templateId) return;
    setSaving(true);
    try {
      // Create a routine from the picked template via the API.
      const templates: Record<string, { title: string; emoji: string }> = {
        tpl_morning_gentle: { title: "Gentle morning", emoji: "🌤️" },
        tpl_work_launch: { title: "Launch into work", emoji: "🚀" },
        tpl_soft_landing: { title: "Soft landing", emoji: "🌙" },
      };
      const tpl = templates[templateId];
      if (tpl) {
        await fetch("/api/v1/activities", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tz: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
            dtstartLocal: new Date().toISOString(),
            title: tpl.title,
            emoji: tpl.emoji,
            durationMin: 40,
            source: "manual",
          }),
        });
      }
    } catch {
      // Best-effort; onboarding continues.
    }
    setSaving(false);
  };

  const requestNotifications = async () => {
    try {
      if ("Notification" in window) {
        await Notification.requestPermission();
      }
    } catch {
      // Permission request failed — not critical.
    }
    router.push("/app/today");
  };

  return (
    <div className="min-h-dvh bg-canvas px-4 py-12">
      {step === 1 && (
        <StepFrame step={1}>
          <div className="text-center">
            <span className="mx-auto grid size-16 place-items-center rounded-3xl bg-iris text-3xl text-ink-inverse shadow-float">
              ◔
            </span>
            <h2 className="mt-6 font-display text-3xl font-bold leading-tight">
              Time you can see.
            </h2>
            <p className="mx-auto mt-3 max-w-xs text-[15px] leading-relaxed text-ink-soft">
              Kairo turns your day into shapes and colors your brain can actually
              hold onto. No shame, no streak-guilt, no 47 features on day one.
            </p>
            <button
              onClick={() => setStep(2)}
              className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-iris py-3.5 text-[15px] font-semibold text-ink-inverse shadow-card"
            >
              Let&apos;s set you up
              <ArrowRight size={17} />
            </button>
            <button
              onClick={() => router.push("/app/today")}
              className="mt-2.5 w-full py-2 text-[13px] font-semibold text-ink-faint"
            >
              I&apos;ll explore on my own
            </button>
          </div>
        </StepFrame>
      )}

      {step === 2 && (
        <StepFrame step={2}>
          <h2 className="font-display text-2xl font-bold leading-tight">
            What does planning usually feel like?
          </h2>
          <p className="mt-1.5 text-[14px] text-ink-soft">
            Pick any that ring true — this tunes your defaults, nothing else.
          </p>
          <div className="mt-5 space-y-2">
            {quizOptions.map((o) => (
              <button
                key={o.id}
                onClick={() => toggleQuiz(o.id)}
                className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3.5 text-left transition-all ${
                  quizPicks.has(o.id)
                    ? "border-iris bg-iris-ghost"
                    : "border-border bg-surface hover:border-border-strong"
                }`}
              >
                <span className="text-xl" aria-hidden>
                  {o.emoji}
                </span>
                <span className="flex-1 text-[14.5px] font-semibold">{o.label}</span>
                <span
                  className={`grid size-6 place-items-center rounded-full ${
                    quizPicks.has(o.id)
                      ? "bg-iris text-ink-inverse"
                      : "border-2 border-border-strong"
                  }`}
                >
                  {quizPicks.has(o.id) && <Check size={13} strokeWidth={3} />}
                </span>
              </button>
            ))}
          </div>
          <p className="mt-3 rounded-xl bg-surface-sunken px-3 py-2 text-[12px] leading-snug text-ink-soft">
            e.g. &ldquo;Starting is hardest&rdquo; → AI break-it-down is surfaced
            on every task; &ldquo;lose track of time&rdquo; → wrap-up nudges
            default ON.
          </p>
          <button
            onClick={async () => {
              await saveSettings();
              setStep(3);
            }}
            disabled={saving}
            className="mt-5 w-full rounded-2xl bg-iris py-3.5 text-[15px] font-semibold text-ink-inverse shadow-card disabled:opacity-50"
          >
            {saving ? "Saving…" : "Continue"}
          </button>
        </StepFrame>
      )}

      {step === 3 && (
        <StepFrame step={3}>
          <h2 className="font-display text-2xl font-bold leading-tight">
            Start with one routine
          </h2>
          <p className="mt-1.5 text-[14px] text-ink-soft">
            Something small that happens most days. You can change everything later.
          </p>
          <div className="mt-5 space-y-2">
            {templatePick.map((t) => (
              <button
                key={t.id}
                onClick={() => setTemplateId(t.id)}
                className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3.5 text-left transition-all ${
                  templateId === t.id
                    ? "border-iris bg-iris-ghost"
                    : "border-border bg-surface hover:border-border-strong"
                }`}
              >
                <span className="grid size-11 place-items-center rounded-2xl bg-surface-sunken text-xl">
                  {t.emoji}
                </span>
                <span className="flex-1">
                  <span className="block text-[14.5px] font-semibold">{t.title}</span>
                  <span className="tnum block text-[12px] font-medium text-ink-soft">
                    {t.meta}
                  </span>
                </span>
                {templateId === t.id && (
                  <span className="grid size-6 place-items-center rounded-full bg-iris text-ink-inverse">
                    <Check size={13} strokeWidth={3} />
                  </span>
                )}
              </button>
            ))}
          </div>
          <button
            onClick={async () => {
              await saveTemplate();
              setStep(4);
            }}
            disabled={saving || !templateId}
            className="mt-5 w-full rounded-2xl bg-iris py-3.5 text-[15px] font-semibold text-ink-inverse shadow-card disabled:opacity-50"
          >
            {saving ? "Adding…" : "Add to my mornings"}
          </button>
          <button
            onClick={() => setStep(4)}
            className="mt-2.5 w-full py-2 text-[13px] font-semibold text-ink-faint"
          >
            Skip — start from a blank day
          </button>
        </StepFrame>
      )}

      {step === 4 && (
        <StepFrame step={4}>
          <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-iris-soft text-iris">
            <Bell size={26} />
          </span>
          <h2 className="mt-5 text-center font-display text-2xl font-bold leading-tight">
            Gentle nudges, only if you want them
          </h2>
          <p className="mx-auto mt-1.5 max-w-xs text-center text-[14px] leading-relaxed text-ink-soft">
            A soft chime when something starts, a heads-up before it ends. Never
            a guilt trip. Change any of it in Settings.
          </p>
          <div className="mt-5 space-y-2 text-[14px] font-semibold">
            {["When an activity starts", "5 minutes before it ends"].map((l) => (
              <div
                key={l}
                className="flex items-center justify-between rounded-2xl border border-border bg-surface px-4 py-3"
              >
                {l}
                <span className="relative inline-flex h-7 w-12 rounded-full bg-iris">
                  <span className="absolute top-0.5 size-6 translate-x-[22px] rounded-full bg-surface-raised shadow-card" />
                </span>
              </div>
            ))}
          </div>
          <button
            onClick={requestNotifications}
            className="mt-5 w-full rounded-2xl bg-iris py-3.5 text-[15px] font-semibold text-ink-inverse shadow-card"
          >
            Turn on notifications
          </button>
          <button
            onClick={() => router.push("/app/today")}
            className="mt-2.5 w-full py-2 text-[13px] font-semibold text-ink-faint"
          >
            Maybe later — take me to Today
          </button>
          <p className="mt-3 text-center text-[11.5px] text-ink-soft">
            The browser permission prompt fires only after this button (user
            gesture — required for iOS PWA push).
          </p>
        </StepFrame>
      )}
    </div>
  );
}
