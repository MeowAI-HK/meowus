"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type NavButtonSize = "default" | "sm";

type NavButtonProps = {
  icon: React.ReactNode;
  label?: string;
  showLabel?: boolean;
  isActive?: boolean;
  size?: NavButtonSize;
  className?: string;
};

const iconSizeClasses: Record<NavButtonSize, string> = {
  default: "h-12 w-12",
  sm: "h-10 w-10",
};

const labelSizeClasses: Record<NavButtonSize, string> = {
  default: "text-[10px]",
  sm: "text-[9px]",
};

export const NavButton = React.forwardRef<HTMLDivElement, NavButtonProps>(function NavButton(
  {
    icon,
    label,
    showLabel = true,
    isActive = false,
    size = "default",
    className,
  },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn(
        "flex cursor-pointer flex-col items-center gap-1 transition-all duration-200 active:scale-95",
        className,
      )}
    >
      <div
        className={cn(
          "flex items-center justify-center rounded-xl transition-all duration-200",
          iconSizeClasses[size],
          isActive
            ? "bg-blue-100 text-blue-600 shadow-[inset_0_0_0_1px_rgba(191,219,254,0.85)]"
            : "text-slate-500 hover:bg-white/80 hover:text-slate-900",
        )}
      >
        {icon}
      </div>
      {showLabel && label ? (
        <span
          className={cn(
            "px-1 text-center font-medium leading-tight transition-colors duration-200",
            labelSizeClasses[size],
            isActive ? "text-blue-600" : "text-slate-500",
          )}
        >
          {label}
        </span>
      ) : null}
    </div>
  );
});