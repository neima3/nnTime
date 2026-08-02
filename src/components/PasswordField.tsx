"use client";

import { useId } from "react";
import type { InputHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";

export function PasswordField({
  label,
  value,
  onChange,
  visible,
  onVisibleChange,
  ...rest
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  visible: boolean;
  onVisibleChange: (visible: boolean) => void;
} & Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "value" | "onChange"
>) {
  const inputId = useId();

  return (
    <div>
      <label
        htmlFor={inputId}
        className="mb-1.5 block text-[13px] font-semibold text-ink-soft"
      >
        {label}
      </label>
      <div className="relative">
        <input
          {...rest}
          id={inputId}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="w-full rounded-xl border border-border bg-surface-sunken px-3.5 py-2.5 pr-12 text-[15px] text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-iris focus:bg-surface focus:ring-2 focus:ring-iris/30"
        />
        <button
          type="button"
          aria-label="Show password"
          aria-pressed={visible}
          aria-controls={inputId}
          onClick={() => onVisibleChange(!visible)}
          className="absolute right-0 top-1/2 grid min-h-11 min-w-11 -translate-y-1/2 place-items-center rounded-r-xl text-ink-faint transition-colors hover:bg-iris-ghost hover:text-ink focus-visible:bg-iris-ghost active:bg-iris-soft"
        >
          {visible ? (
            <EyeOff size={18} aria-hidden="true" />
          ) : (
            <Eye size={18} aria-hidden="true" />
          )}
        </button>
      </div>
    </div>
  );
}
