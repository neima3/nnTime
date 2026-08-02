"use client";

/**
 * Apply built-in templates → real activity series (10× Phase 13).
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { catClasses, type CategoryId } from "@/lib/mock";
import { localMinutesToInstant } from "@/lib/adapters";
import { clientToday } from "@/lib/client-date";
import { appReturnTo, authPageHref } from "@/lib/auth-return";

export type TemplateCard = {
  id: string;
  title: string;
  emoji: string;
  category: CategoryId;
  group: string;
  steps: string[];
  minutes: number;
};

export function TemplatesClient({
  templates,
  authed,
  selectedTemplateId,
}: {
  templates: TemplateCard[];
  authed: boolean;
  selectedTemplateId?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const selectedTemplate = templates.find(
    (template) => template.id === selectedTemplateId,
  );
  const [msg, setMsg] = useState<string | null>(null);
  const resumeMsg =
    authed && selectedTemplate
      ? `Welcome back — “${selectedTemplate.title}” is ready when you are.`
      : null;
  const visibleMsg = msg ?? resumeMsg;
  const selectedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!selectedTemplate || !selectedRef.current) return;
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    selectedRef.current.scrollIntoView({
      block: "center",
      behavior: reducedMotion ? "auto" : "smooth",
    });
  }, [selectedTemplate]);

  async function apply(t: TemplateCard) {
    if (!authed) {
      setMsg("Sign in to apply templates.");
      return;
    }
    setBusy(t.id);
    setMsg(null);
    try {
      const setRes = await fetch("/api/v1/settings");
      const settings = setRes.ok ? await setRes.json() : null;
      const tz =
        settings?.timezone ??
        Intl.DateTimeFormat().resolvedOptions().timeZone;
      const date = clientToday(tz);
      const catRes = await fetch("/api/v1/categories");
      const cats = catRes.ok ? (await catRes.json()).items ?? [] : [];
      const cat = cats.find((c: { key: string }) => c.key === t.category);
      const startMin = 9 * 60;
      const dtstartLocal = localMinutesToInstant(date, startMin, tz);

      const res = await fetch("/api/v1/activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tz,
          dtstartLocal,
          title: t.title,
          emoji: t.emoji,
          categoryId: cat?.id,
          durationMin: t.minutes,
          checklistTemplate: t.steps.map((label) => ({ label, done: false })),
          source: "manual",
        }),
      });
      if (!res.ok) {
        setMsg("Couldn't apply that template — try again");
        setBusy(null);
        return;
      }
      setMsg(`Applied “${t.title}” to Today.`);
      router.push(`/app/today?date=${date}`);
      router.refresh();
    } catch {
      setMsg("Couldn't reach the server — try again?");
    }
    setBusy(null);
  }

  return (
    <div>
      {visibleMsg && (
        <p role="status" className="mb-4 text-[13px] font-semibold text-iris">
          {visibleMsg}
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {templates.map((t) => {
          const cat = catClasses[t.category];
          return (
            <article
              key={t.id}
              id={`template-${t.id}`}
              ref={t.id === selectedTemplateId ? selectedRef : undefined}
              className={`flex flex-col rounded-3xl border bg-surface p-5 shadow-card ${
                t.id === selectedTemplateId
                  ? "border-iris ring-2 ring-iris/30"
                  : "border-border"
              }`}
            >
              <div className="flex items-start gap-3">
                <span
                  className={`grid size-12 place-items-center rounded-2xl text-xl ${cat.fill}`}
                >
                  {t.emoji}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-ink-faint">
                    {t.group}
                  </p>
                  <h2 className="font-display text-lg font-bold">{t.title}</h2>
                  <p className="tnum mt-0.5 text-[12px] font-medium text-ink-soft">
                    {t.minutes} min · {t.steps.length} steps
                  </p>
                </div>
              </div>
              <ul className="mt-3 flex-1 space-y-1 text-[13px] text-ink-soft">
                {t.steps.slice(0, 3).map((s) => (
                  <li key={s}>· {s}</li>
                ))}
              </ul>
              {authed ? (
                <button
                  type="button"
                  disabled={busy === t.id}
                  onClick={() => void apply(t)}
                  className="mt-4 inline-flex items-center gap-1.5 self-start rounded-xl bg-iris-soft px-4 py-2 text-[13px] font-semibold text-iris transition-colors hover:bg-iris hover:text-ink-inverse disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-iris focus-visible:outline-none"
                >
                  {busy === t.id ? "Applying…" : "Apply to Today"}
                </button>
              ) : (
                <Link
                  href={authPageHref(
                    "sign-in",
                    appReturnTo("/app/templates", { template: t.id }),
                  )}
                  className="mt-4 inline-flex items-center gap-1.5 self-start rounded-xl bg-iris-soft px-4 py-2 text-[13px] font-semibold text-iris transition-colors hover:bg-iris hover:text-ink-inverse focus-visible:ring-2 focus-visible:ring-iris focus-visible:outline-none"
                >
                  Sign in to apply
                </Link>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
