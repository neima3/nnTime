import {
  Check,
  ChevronDown,
  Flag,
  GripVertical,
  Plus,
  Repeat,
  Sparkles,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";

/* Design reference: activity editor in "edit existing recurring activity" state.
   Desktop = centered 560px modal over scrim; mobile = full-height bottom sheet
   with drag handle (this mock renders the modal layout responsively). */

const categories = [
  { id: "peach", fill: "bg-cat-peach", ink: "text-cat-peach-ink", label: "Life" },
  { id: "butter", fill: "bg-cat-butter", ink: "text-cat-butter-ink", label: "Morning" },
  { id: "mint", fill: "bg-cat-mint", ink: "text-cat-mint-ink", label: "Body" },
  { id: "sky", fill: "bg-cat-sky", ink: "text-cat-sky-ink", label: "Work" },
  { id: "lilac", fill: "bg-cat-lilac", ink: "text-cat-lilac-ink", label: "Deep" },
  { id: "rose", fill: "bg-cat-rose", ink: "text-cat-rose-ink", label: "People" },
];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-[12px] font-bold uppercase tracking-[0.1em] text-ink-soft">
        {label}
      </p>
      {children}
    </div>
  );
}

const chip =
  "rounded-xl border border-border bg-surface px-3 py-2 text-[14px] font-semibold text-ink";

export default function EditorPage() {
  return (
    <AppShell active="today">
      {/* scrim + dimmed context */}
      <div className="relative min-h-dvh bg-surface-sunken/60 px-4 py-8">
        <div className="mx-auto w-full max-w-[560px] overflow-hidden rounded-3xl border border-border bg-surface shadow-float">
          {/* mobile drag handle */}
          <div className="flex justify-center pt-2.5 md:hidden" aria-hidden>
            <span className="h-1 w-9 rounded-full bg-border-strong" />
          </div>

          {/* header */}
          <div className="flex items-center justify-between px-6 pt-4">
            <h1 className="font-display text-xl font-bold">Edit activity</h1>
            <button
              aria-label="Close"
              className="grid size-9 place-items-center rounded-xl text-ink-soft hover:bg-surface-sunken"
            >
              <X size={18} />
            </button>
          </div>

          <div className="space-y-5 px-6 py-5">
            {/* title + emoji */}
            <div className="flex items-center gap-3">
              <button
                aria-label="Change icon"
                className="grid size-14 shrink-0 place-items-center rounded-2xl bg-cat-sky text-2xl shadow-card transition-transform hover:scale-105"
              >
                💊
              </button>
              <input
                defaultValue="Pharmacy shift prep"
                className="w-full rounded-2xl border border-border bg-surface-raised px-4 py-3.5 text-[17px] font-semibold outline-none focus:ring-2 focus:ring-iris"
              />
            </div>

            {/* category */}
            <Field label="Category">
              <div className="flex flex-wrap gap-2">
                {categories.map((c) => {
                  const selected = c.id === "sky";
                  return (
                    <button
                      key={c.id}
                      className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-semibold transition-all ${c.fill} ${c.ink} ${
                        selected
                          ? "ring-2 ring-iris ring-offset-2 ring-offset-surface"
                          : "opacity-70 hover:opacity-100"
                      }`}
                    >
                      {selected && <Check size={13} strokeWidth={3} />}
                      {c.label}
                    </button>
                  );
                })}
              </div>
            </Field>

            {/* when */}
            <Field label="When">
              <div className="flex flex-wrap items-center gap-2">
                <button className={chip}>Sat, Jul 12</button>
                <button className={`${chip} tnum`}>13:30</button>
                <span className="text-ink-faint">→</span>
                <button className={`${chip} tnum`}>1 h</button>
                <button className="rounded-xl bg-iris-soft px-3 py-2 text-[13px] font-semibold text-iris">
                  Anytime instead
                </button>
              </div>
            </Field>

            {/* repeat — with edit-scope note */}
            <Field label="Repeat">
              <button className="flex w-full items-center justify-between rounded-xl border border-border bg-surface px-3 py-2.5">
                <span className="flex items-center gap-2 text-[14px] font-semibold">
                  <Repeat size={15} className="text-iris" />
                  Weekdays · until removed
                </span>
                <ChevronDown size={16} className="text-ink-faint" />
              </button>
              <p className="mt-1.5 rounded-xl bg-iris-ghost px-3 py-2 text-[12.5px] leading-snug text-ink-soft">
                Saving will ask: <strong>this event</strong>, <strong>this and
                future</strong>, or <strong>all events</strong>.
              </p>
            </Field>

            {/* energy + priority */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Energy">
                <div className="flex gap-1.5">
                  {(["Low", "Medium", "High"] as const).map((e) => (
                    <button
                      key={e}
                      className={`flex-1 rounded-xl px-2 py-2 text-[13px] font-semibold transition-colors ${
                        e === "Medium"
                          ? "bg-iris text-ink-inverse"
                          : "border border-border bg-surface text-ink-soft"
                      }`}
                    >
                      <Zap size={13} className="mr-1 inline" />
                      {e}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Priority">
                <div className="flex gap-1.5">
                  {(["None", "Low", "High"] as const).map((p) => (
                    <button
                      key={p}
                      className={`flex-1 rounded-xl px-2 py-2 text-[13px] font-semibold transition-colors ${
                        p === "None"
                          ? "bg-ink text-ink-inverse"
                          : "border border-border bg-surface text-ink-soft"
                      }`}
                    >
                      {p !== "None" && (
                        <Flag size={12} className="mr-1 inline" fill="currentColor" />
                      )}
                      {p}
                    </button>
                  ))}
                </div>
              </Field>
            </div>

            {/* checklist */}
            <Field label="Steps">
              <div className="space-y-1.5">
                {["Review schedule", "Pack bag"].map((s, i) => (
                  <div
                    key={s}
                    className="group flex items-center gap-2 rounded-xl border border-border bg-surface px-2.5 py-2"
                  >
                    <GripVertical
                      size={14}
                      className="cursor-grab text-ink-faint"
                      aria-label="Reorder"
                    />
                    <span
                      className={`grid size-5 place-items-center rounded-full border-2 ${
                        i === 0
                          ? "border-transparent bg-success text-ink-inverse"
                          : "border-border-strong"
                      }`}
                    >
                      {i === 0 && <Check size={12} strokeWidth={3} />}
                    </span>
                    <span className="flex-1 text-[14px] font-medium">{s}</span>
                    <button
                      aria-label="Remove step"
                      className="text-ink-faint opacity-0 transition-opacity hover:text-danger group-hover:opacity-100"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <button className="flex flex-1 items-center gap-2 rounded-xl border border-dashed border-border-strong px-3 py-2 text-[13px] font-semibold text-ink-soft hover:text-ink">
                    <Plus size={14} />
                    Add step
                  </button>
                  <button className="flex items-center gap-1.5 rounded-xl bg-iris-soft px-3 py-2 text-[13px] font-semibold text-iris transition-colors hover:bg-iris-ghost">
                    <Sparkles size={14} />
                    Break it down
                  </button>
                </div>
              </div>
            </Field>

            {/* tags + notes */}
            <Field label="Tags">
              <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-2.5">
                <span className="rounded-md bg-surface-sunken px-2 py-0.5 text-[12px] font-semibold text-ink-soft">
                  #work <X size={10} className="ml-0.5 inline" />
                </span>
                <input
                  placeholder="Add tag…"
                  className="min-w-24 flex-1 bg-transparent text-[13px] font-medium outline-none placeholder:text-ink-faint"
                />
              </div>
            </Field>
            <Field label="Notes">
              <textarea
                rows={2}
                placeholder="Anything future-you should know…"
                className="w-full resize-none rounded-xl border border-border bg-surface px-3 py-2.5 text-[14px] outline-none placeholder:text-ink-faint focus:ring-2 focus:ring-iris"
              />
            </Field>
          </div>

          {/* footer */}
          <div className="flex items-center gap-3 border-t border-border bg-surface-raised px-6 py-4">
            <button className="flex items-center gap-1.5 rounded-xl px-3 py-2.5 text-[14px] font-semibold text-danger hover:bg-danger-soft">
              <Trash2 size={15} />
              Delete
            </button>
            <div className="ml-auto flex gap-2">
              <button className="rounded-xl border border-border bg-surface px-4 py-2.5 text-[14px] font-semibold text-ink-soft hover:text-ink">
                Cancel
              </button>
              <button className="rounded-xl bg-iris px-6 py-2.5 text-[14px] font-semibold text-ink-inverse shadow-card transition-colors hover:bg-iris-deep">
                Save
              </button>
            </div>
          </div>
        </div>

        <p className="mx-auto mt-4 max-w-[560px] text-center text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-faint">
          Design reference — desktop modal · mobile renders as full-height bottom sheet
        </p>
      </div>
    </AppShell>
  );
}
