"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { PRODUCT_SHORT_NAME } from "@/lib/product-branding";
import { cn } from "@/lib/utils";

interface LogoButtonProps {
  href?: string;
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  showBackground?: boolean;
  onClick?: () => void;
  className?: string;
  ariaLabel?: string;
}

const sizeConfig = {
  sm: { image: 32, text: "text-xl", container: "h-10 w-10" },
  md: { image: 44, text: "text-2xl", container: "h-12 w-12" },
  lg: { image: 56, text: "text-3xl", container: "h-14 w-14" },
};

export function LogoButton({
  href,
  size = "sm",
  showText = false,
  showBackground = false,
  onClick,
  className,
  ariaLabel = "Go to sites",
}: LogoButtonProps) {
  const router = useRouter();
  const [isHovering, setIsHovering] = React.useState(false);
  const [isLaunching, setIsLaunching] = React.useState(false);
  const [showRipple, setShowRipple] = React.useState(false);
  const config = sizeConfig[size];

  const handleActivate = () => {
    if (isLaunching || (!href && !onClick)) {
      return;
    }

    setIsLaunching(true);
    setIsHovering(false);
    setShowRipple(true);

    window.setTimeout(() => {
      setShowRipple(false);
    }, 500);

    window.setTimeout(() => {
      onClick?.();
      if (href) {
        router.push(href);
      }
      setIsLaunching(false);
    }, 500);
  };

  const rocketClassName = isLaunching
    ? "rocket-launch"
    : isHovering
      ? "rocket-hover"
      : "";

  return (
    <button
      type="button"
      onClick={handleActivate}
      onMouseEnter={() => !isLaunching && setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      aria-label={ariaLabel}
      className={cn("flex items-center gap-2 bg-transparent", className)}
    >
      <div
        className={cn(
          "rocket-button relative flex shrink-0 items-center justify-center overflow-visible",
          !showBackground && "rocket-button-plain",
          showRipple && "rocket-button-ripple",
          showBackground && cn(config.container, "rounded-lg dark:bg-blue-900/50"),
        )}
      >
        <Image
          src="/logo.webp"
          alt={PRODUCT_SHORT_NAME}
          width={config.image}
          height={config.image}
          priority
          className={cn(
            rocketClassName,
            !showBackground && "drop-shadow-[0_10px_24px_rgba(37,99,235,0.18)]",
          )}
        />
      </div>

      {showText ? (
        <span className={cn("font-bold text-foreground", config.text)}>{PRODUCT_SHORT_NAME}</span>
      ) : null}
    </button>
  );
}