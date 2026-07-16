"use client";

/**
 * PWA install prompt — shows a dismissible banner when the browser
 * supports installation and the app hasn't been installed yet.
 */
import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<{ prompt: () => Promise<void> } | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as unknown as { prompt: () => Promise<void> });
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (!deferredPrompt || dismissed) return null;

  return (
    <div className="fixed bottom-20 left-1/2 z-40 w-[90%] max-w-sm -translate-x-1/2 rounded-2xl border border-border bg-surface p-4 shadow-float md:bottom-4">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-iris-ghost text-xl">
          ◔
        </span>
        <div className="flex-1">
          <p className="text-[14px] font-bold">Install Kairo</p>
          <p className="mt-0.5 text-[13px] text-ink-soft">
            Add to your home screen for a full-screen, offline-ready experience.
          </p>
          <div className="mt-2.5 flex gap-2">
            <button
              onClick={async () => {
                await deferredPrompt.prompt();
                setDeferredPrompt(null);
                setDismissed(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-iris px-3 py-1.5 text-[13px] font-semibold text-ink-inverse"
            >
              <Download size={14} />
              Install
            </button>
            <button
              onClick={() => setDismissed(true)}
              className="rounded-xl px-3 py-1.5 text-[13px] font-semibold text-ink-soft hover:bg-surface-sunken"
            >
              Not now
            </button>
          </div>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="text-ink-faint hover:text-ink"
          aria-label="Dismiss"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
