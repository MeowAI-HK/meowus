import React from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline";
type Size = "sm" | "md" | "lg" | "icon";

const variantClasses: Record<Variant, string> = {
  primary:
    "border border-transparent bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-[0_4px_14px_-4px_rgba(14,165,233,0.4)] hover:brightness-110",
  secondary:
    "border border-transparent bg-secondary text-secondary-foreground shadow-sm hover:bg-accent",
  ghost:
    "bg-transparent text-muted-foreground hover:bg-accent hover:text-accent-foreground",
  danger:
    "border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100",
  outline:
    "border border-border bg-background text-foreground hover:bg-accent hover:text-accent-foreground",
};

const sizeClasses: Record<Size, string> = {
  sm: "h-9 gap-1.5 px-4 text-xs",
  md: "h-10 gap-2 px-6 text-sm",
  lg: "h-11 gap-2 px-8 text-base",
  icon: "h-10 w-10",
};

type ButtonProps = {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  className?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>;

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  className = "",
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-full font-medium ring-offset-background transition-all duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        "disabled:pointer-events-none disabled:opacity-50 active:scale-[0.96]",
        "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
    >
      {loading ? (
        <svg
          className="size-4 shrink-0 animate-spin"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
      ) : null}
      {children}
    </button>
  );
}
