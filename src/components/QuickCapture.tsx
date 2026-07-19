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
import { Loader2, Mic, MicOff, PenLine, Sparkles, X } from "lucide-react";
import { toast } from "./Toast";
import { notifyDayChanged } from "./NowBar";
import { localMinutesToInstant } from "@/lib/adapters";
import { clientToday } from "@/lib/client-date";
import { fmt } from "@/lib/mock";

/** AI-parsed draft (SEC-05: suggestion only — nothing saves until accepted). */
interface Proposal {
  title: string;
  emoji?: string;
  durationMin?: number;
  energy?: "low" | "medium" | "high";
  date?: string;
  startMin?: number;
}

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
  const [aiOk, setAiOk] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const voiceSupported = getSpeechRecognition() != null;

  // Probe AI availability once per mount (drives the Magic add button only).
  useEffect(() => {
    let cancelled = false;
    fetch("/api/health")
      .then((r) => (r.ok ? r.json() : null))
      .then((h) => {
        if (!cancelled && h?.checks?.ai === "ok") setAiOk(true);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Programmatic opens: command palette event + PWA shortcut (?capture=1).
  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener("kairo:quick-capture", onOpen);
    try {
      if (new URLSearchParams(window.location.search).get("capture") === "1") {
        /* eslint-disable react-hooks/set-state-in-effect */
        setOpen(true);
        /* eslint-enable react-hooks/set-state-in-effect */
      }
    } catch {}
    return () => window.removeEventListener("kairo:quick-capture", onOpen);
  }, []);

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
    setProposal(null);
    setParsing(false);
  }, [stopListening]);

  /** "Magic add": parse the text; render a confirm chip. Never auto-saves. */
  const magicParse = useCallback(async () => {
    const input = text.trim();
    if (!input || parsing) return;
    setParsing(true);
    setProposal(null);
    try {
      const res = await fetch("/api/v1/ai/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input }),
      });
      if (!res.ok) {
        toast("Magic add is resting — captured as plain text instead");
        setParsing(false);
        return;
      }
      const draft = (await res.json()) as Proposal;
      setProposal(draft);
    } catch {
      toast("Magic add is resting — captured as plain text instead");
    }
    setParsing(false);
  }, [text, parsing]);

  /** Accept the AI proposal → scheduled activity or dated/loose task. */
  const acceptProposal = useCallback(async () => {
    if (!proposal || saving) return;
    setSaving(true);
    try {
      let zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      try {
        const s = await fetch("/api/v1/settings").then((r) =>
          r.ok ? r.json() : null,
        );
        if (s?.timezone) zone = s.timezone;
      } catch {}

      if (proposal.startMin != null) {
        const date = proposal.date ?? clientToday(zone);
        const res = await fetch("/api/v1/activities", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tz: zone,
            dtstartLocal: localMinutesToInstant(date, proposal.startMin, zone),
            title: proposal.title,
            emoji: proposal.emoji ?? "📋",
            durationMin: proposal.durationMin ?? 30,
            energy: proposal.energy ?? null,
            source: "manual",
          }),
        });
        if (!res.ok) throw new Error("create failed");
        toast(`On the timeline — ${date === clientToday(zone) ? "today" : date} ${fmt(proposal.startMin)}`);
      } else {
        const res = await fetch("/api/v1/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bucket: proposal.date ? "anytime" : "inbox",
            date: proposal.date ?? undefined,
            title: proposal.title,
            emoji: proposal.emoji,
            energy: proposal.energy ?? undefined,
          }),
        });
        if (!res.ok) throw new Error("create failed");
        toast(proposal.date ? `Planned for ${proposal.date}` : "Captured — it's in your inbox");
      }
      notifyDayChanged();
      setProposal(null);
      setText("");
      setCaptured((n) => n + 1);
      inputRef.current?.focus();
    } catch {
      toast("Couldn't save — try again");
    }
    setSaving(false);
  }, [proposal, saving]);

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
              {aiOk && (
                <button
                  type="button"
                  aria-label="Magic add — understand date and time"
                  title="Magic add (AI): understands dates & times"
                  disabled={!text.trim() || parsing}
                  onClick={() => void magicParse()}
                  className="grid size-11 shrink-0 place-items-center rounded-2xl border border-iris/40 bg-iris-ghost text-iris transition-colors hover:bg-iris-soft disabled:opacity-50"
                >
                  {parsing ? (
                    <Loader2 size={17} className="animate-spin" />
                  ) : (
                    <Sparkles size={17} />
                  )}
                </button>
              )}
              <button
                type="button"
                disabled={!text.trim() || saving}
                onClick={() => void save(false)}
                className="grid h-11 shrink-0 place-items-center rounded-2xl bg-iris px-4 text-[14px] font-semibold text-ink-inverse transition-all hover:bg-iris-deep active:scale-[0.98] disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  "Save"
                )}
              </button>
            </div>

            {proposal && (
              <div className="rise-in mt-3 flex flex-wrap items-center gap-3 rounded-2xl border border-iris/30 bg-iris-ghost px-3.5 py-3">
                <span className="text-lg" aria-hidden>
                  {proposal.emoji ?? "📋"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-semibold">
                    {proposal.title}
                  </p>
                  <p className="tnum text-[12px] font-medium text-ink-soft">
                    {proposal.startMin != null
                      ? `${proposal.date ?? "today"} · ${fmt(proposal.startMin)} · ${proposal.durationMin ?? 30} min`
                      : proposal.date
                        ? `${proposal.date} · anytime`
                        : "no date — goes to inbox"}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void acceptProposal()}
                    className="rounded-xl bg-iris px-3 py-1.5 text-[12.5px] font-bold text-ink-inverse hover:bg-iris-deep disabled:opacity-50"
                  >
                    {proposal.startMin != null ? "Add to timeline" : "Add it"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setProposal(null)}
                    className="rounded-xl px-2.5 py-1.5 text-[12.5px] font-semibold text-ink-soft hover:bg-surface-sunken"
                  >
                    Never mind
                  </button>
                </div>
              </div>
            )}
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
