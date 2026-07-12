import React from "react";
import { cn } from "@/lib/utils";
import { consoleInputClass } from "./console-surface";

export type SelectOption<T extends string> = {
  value: T;
  label: string;
  disabled?: boolean;
};

export function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
  className,
}: {
  label: string;
  value: T;
  options: Array<SelectOption<T>>;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <label className={cn("grid gap-1.5 text-sm font-medium text-zinc-700", className)}>
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value as T)} className={consoleInputClass}>
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  className,
}: {
  value: T;
  options: Array<SelectOption<T>>;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div className={cn("inline-flex rounded-lg border border-sky-100 bg-sky-50 p-1", className)}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          disabled={option.disabled}
          className={cn(
            "rounded-md px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50",
            value === option.value ? "bg-white text-sky-700 shadow-sm" : "text-zinc-500 hover:text-zinc-900",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function SectionPanel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-xl border border-sky-100 bg-white/70 p-4", className)}>
      {children}
    </section>
  );
}

export function IconButton({
  label,
  children,
  className,
  ...props
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
    >
      {children}
    </button>
  );
}
