import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, ShieldCheck } from "lucide-react";
import { privacyPolicy } from "@/lib/privacy-policy";

export const metadata: Metadata = {
  title: "Privacy · Kairo",
  description:
    "How Kairo handles planner information, optional integrations, and on-device Apple Health features.",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-dvh bg-canvas">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-4">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center gap-2.5 rounded-xl pr-3 font-display text-lg font-bold tracking-tight"
          >
            <span className="grid size-9 place-items-center rounded-xl bg-iris text-lg text-ink-inverse shadow-card">
              ◔
            </span>
            Kairo
          </Link>
          <Link
            href="/"
            className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-ink-soft transition-colors hover:bg-surface-sunken hover:text-ink"
          >
            <ArrowLeft size={16} aria-hidden />
            Back to Kairo
          </Link>
        </div>
      </header>

      <main>
        <section className="border-b border-border bg-surface">
          <div className="mx-auto w-full max-w-6xl px-5 py-14 md:py-20">
            <p className="text-[13px] font-bold uppercase tracking-[0.14em] text-iris">
              Privacy, in plain language
            </p>
            <h1 className="mt-4 max-w-3xl font-display text-4xl font-bold leading-tight tracking-tight md:text-6xl">
              Your plans are personal.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-ink-soft md:text-lg md:leading-8">
              This policy explains what Kairo receives, why it is needed, and
              which choices stay with you.
            </p>

            <div className="mt-8 max-w-3xl rounded-3xl border border-iris/25 bg-iris-ghost p-5 shadow-card md:p-6">
              <div className="flex items-start gap-4">
                <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-iris-soft text-iris">
                  <ShieldCheck size={21} aria-hidden />
                </span>
                <div>
                  <p className="font-display text-lg font-bold">The short version</p>
                  <p className="mt-1.5 text-base leading-7 text-ink-soft">
                    {privacyPolicy.summary}
                  </p>
                </div>
              </div>
            </div>

            <p className="mt-5 text-sm font-medium text-ink-faint">
              Last updated {privacyPolicy.updated}
            </p>
          </div>
        </section>

        <div className="mx-auto grid w-full max-w-6xl gap-10 px-5 py-12 md:grid-cols-[14rem_minmax(0,1fr)] md:gap-16 md:py-16">
          <nav
            aria-label="Privacy policy sections"
            className="h-fit rounded-2xl border border-border bg-surface p-3 shadow-card md:sticky md:top-6"
          >
            <p className="px-3 pb-2 pt-1 text-[12px] font-bold uppercase tracking-[0.12em] text-ink-faint">
              On this page
            </p>
            <ul>
              {privacyPolicy.sections.map((section) => (
                <li key={section.id}>
                  <a
                    href={`#${section.id}`}
                    className="flex min-h-11 items-center rounded-xl px-3 text-sm font-semibold text-ink-soft transition-colors hover:bg-surface-sunken hover:text-ink"
                  >
                    {section.title}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <article className="min-w-0 max-w-3xl">
            {privacyPolicy.sections.map((section, index) => (
              <section
                key={section.id}
                id={section.id}
                className={`scroll-mt-8 ${
                  index === 0 ? "" : "mt-10 border-t border-border pt-10"
                }`}
              >
                <p className="font-mono text-xs font-bold text-iris">
                  {String(index + 1).padStart(2, "0")}
                </p>
                <h2 className="mt-2 font-display text-2xl font-bold tracking-tight md:text-3xl">
                  {section.title}
                </h2>
                <div className="mt-4 space-y-4 text-base leading-7 text-ink-soft">
                  {section.paragraphs.map((paragraph) => (
                    <p key={paragraph}>
                      {section.id === "contact" ? (
                        <>
                          Questions, privacy requests, and security reports can
                          be sent to{" "}
                          <a
                            href={`mailto:${privacyPolicy.contactEmail}`}
                            className="inline-flex min-h-11 items-center gap-1 font-semibold text-iris underline decoration-iris/35 underline-offset-4 hover:text-iris-deep"
                          >
                            {privacyPolicy.contactEmail}
                            <ArrowUpRight size={14} aria-hidden />
                          </a>
                          .
                        </>
                      ) : (
                        paragraph
                      )}
                    </p>
                  ))}
                  {"bullets" in section && section.bullets ? (
                    <ul className="space-y-3">
                      {section.bullets.map((bullet) => (
                        <li key={bullet} className="flex gap-3">
                          <span
                            className="mt-2.5 size-1.5 shrink-0 rounded-full bg-iris"
                            aria-hidden
                          />
                          <span>{bullet}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </section>
            ))}
          </article>
        </div>
      </main>

      <footer className="border-t border-border bg-surface">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-8 text-sm text-ink-soft">
          <p className="font-semibold">Kairo — a nnTime project</p>
          <Link
            href="/"
            className="inline-flex min-h-11 items-center rounded-xl px-3 font-semibold transition-colors hover:bg-surface-sunken hover:text-ink"
          >
            Return to Kairo
          </Link>
        </div>
      </footer>
    </div>
  );
}
