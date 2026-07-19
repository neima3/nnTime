"use client";

/**
 * Quick capture (10× ADHD Phase 3 — working memory).
 *
 * A thought must be capturable in under three seconds from anywhere: press
 * `c` (desktop) or the ✎ button (mobile) → type or dictate → Enter. Saves to
 * the inbox brain-dump bucket. Shift+Enter saves and keeps the sheet open for
 * chain-dumping. Voice uses the Web Speech API where the browser has it.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Mic, MicOff, PenLine, X } from "lucide-react";
import { toast } from "./Toast";

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }>;
}

function getSpeechRecognition(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, unknown>;
  return (
    (w.SpeechRecognition as new () => SpeechRecognitionLike) ??
    (w.webkitSpeechRecognition as new () => SpeechRecognitionLike) ??
    null
  );
}

export function QuickCapture() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [captured, setCaptured] = useState(0);
  const [listening, setListening] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const voiceSupported = getSpeechRecognition() != null;

  // `c` opens capture from anywhere (outside inputs).
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable ||
        target.tagName === "SELECT"
      )
        return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key.toLowerCase() === "c") {
        e.preventDefault();
        setOpen(true);
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setListening(false);
  }, []);

  const close = useCallback(() => {
    stopListening();
    setOpen(false);
    setText("");
    setCaptured(0);
  }, [stopListening]);

  const toggleVoice = useCallback(() => {
    if (listening) {
      stopListening();
      return;
    }
    const Ctor = getSpeechRecognition();
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = navigator.language || "en-US";
    rec.continuous = true;
    rec.interimResults = false;
    rec.onresult = (e) => {
      let transcript = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) transcript += r[0].transcript;
      }
      if (transcript) {
        setText((prev) =>
          prev ? `${prev.trim()} ${transcript.trim()}` : transcript.trim(),
        );
      }
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recognitionRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  }, [listening, stopListening]);

  const save = useCallback(
    async (keepOpen: boolean) => {
      const title = text.trim();
      if (!title || saving) return;
      setSaving(true);
      try {
        const res = await fetch("/api/v1/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bucket: "inbox", title }),
        });
        if (res.status === 401) {
          toast("Sign in to capture thoughts");
          setSaving(false);
          return;
        }
        if (!res.ok) {
          toast("Couldn't save — try again");
          setSaving(false);
          return;
        }
        const created = await res.json();
        setSaving(false);
        setText("");
        setCaptured((n) => n + 1);
        toast(`Captured — it's in your inbox`, {
          actionLabel: "Undo",
          onAction: () => {
            void fetch(`/api/v1/tasks/${created.id}`, {
              method: "DELETE",
              headers: { "If-Match": String(created.revision) },
            });
          },
        });
        if (!keepOpen) {
          setOpen(false);
          setCaptured(0);
        } else {
          inputRef.current?.focus();
        }
      } catch {
        toast("Couldn't save — try again");
        setSaving(false);
      }
    },
    [text, saving],
  );

  return (
    <>
      {/* Mobile capture button — mirrors the FAB on the left, above the tab bar. */}
      <button
        type="button"
        aria-label="Quick capture a thought"
        onClick={() => setOpen(true)}
        className="fixed bottom-24 left-5 z-40 grid size-12 place-items-center rounded-2xl border border-border bg-surface text-ink-soft shadow-float transition-transform hover:scale-105 active:scale-95 md:hidden"
      >
        <PenLine size={20} />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-ink/20 px-4 pt-[18dvh] backdrop-blur-[2px]"
          onClick={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <div
            role="dialog"
            aria-label="Quick capture"
            className="rise-in w-full max-w-lg rounded-3xl border border-border bg-surface p-4 shadow-float"
          >
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink-faint">
                Get it out of your head
              </p>
              <button
                type="button"
                aria-label="Close"
                onClick={close}
                className="rounded-lg p-1 text-ink-faint hover:text-ink"
              >
                <X size={16} />
              </button>
            </div>
            <div className="mt-2.5 flex items-center gap-2">
              <input
                ref={inputRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void save(e.shiftKey);
                  }
                  if (e.key === "Escape") close();
                }}
                placeholder={
                  listening ? "Listening…" : "One thought, then let it go…"
                }
                className="w-full rounded-2xl border border-border bg-surface-sunken px-4 py-3 text-[15px] text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-iris focus:bg-surface focus:ring-2 focus:ring-iris/30"
              />
              {voiceSupported && (
                <button
                  type="button"
                  aria-label={listening ? "Stop dictating" : "Dictate"}
                  aria-pressed={listening}
                  onClick={toggleVoice}
                  className={`grid size-11 shrink-0 place-items-center rounded-2xl border transition-colors ${
                    listening
                      ? "border-now/40 bg-now text-now-ink"
                      : "border-border bg-surface text-ink-soft hover:text-ink"
                  }`}
                >
                  {listening ? <MicOff size={18} /> : <Mic size={18} />}
                </button>
              )}
              <button
                type="button"
                disabled={!text.trim() || saving}
                onClick={() => void save(false)}
                className="grid h-11 shrink-0 place-items-center rounded-2xl bg-iris px-4 text-[14px] font-semibold text-ink-inverse transition-colors hover:bg-iris-deep disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  "Save"
                )}
              </button>
            </div>
            <p className="mt-2 text-[12px] text-ink-faint">
              <kbd className="rounded bg-surface-sunken px-1 font-mono">Enter</kbd>{" "}
              saves ·{" "}
              <kbd className="rounded bg-surface-sunken px-1 font-mono">
                Shift+Enter
              </kbd>{" "}
              saves &amp; keeps going
              {captured > 0 && (
                <span className="ml-2 font-semibold text-success">
                  {captured} captured ✓
                </span>
              )}
            </p>
          </div>
        </div>
      )}
    </>
  );
}
