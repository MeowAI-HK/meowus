"use client";

import { useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const CONSOLE_PAGE_SIZE = 20;

export function usePagedItems<T>(items: T[], page: number) {
  const totalPages = Math.max(1, Math.ceil(items.length / CONSOLE_PAGE_SIZE));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const start = (safePage - 1) * CONSOLE_PAGE_SIZE;

  return {
    pageItems: items.slice(start, start + CONSOLE_PAGE_SIZE),
    totalPages,
    safePage,
  };
}

export function useClampConsolePage(page: number, totalItems: number, onPageChange: (page: number) => void) {
  const totalPages = Math.max(1, Math.ceil(totalItems / CONSOLE_PAGE_SIZE));

  useEffect(() => {
    if (page > totalPages) onPageChange(totalPages);
    if (page < 1) onPageChange(1);
  }, [onPageChange, page, totalPages]);
}

export function ConsolePagination({
  page,
  totalItems,
  onPageChange,
  className,
  ariaLabel = "Pagination",
  previousLabel = "Previous page",
  nextLabel = "Next page",
}: {
  page: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  className?: string;
  ariaLabel?: string;
  previousLabel?: string;
  nextLabel?: string;
}) {
  const totalPages = Math.max(1, Math.ceil(totalItems / CONSOLE_PAGE_SIZE));

  if (totalItems <= CONSOLE_PAGE_SIZE) return null;

  return (
    <nav className={cn("flex items-center justify-end gap-3 text-sm text-zinc-500", className)} aria-label={ariaLabel}>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-9 w-9 rounded-2xl"
        onClick={() => onPageChange(Math.max(1, page - 1))}
        disabled={page <= 1}
        aria-label={previousLabel}
      >
        <ChevronLeft className="size-4" />
      </Button>
      <span className="min-w-16 text-center font-medium">
        {page} / {totalPages}
      </span>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-9 w-9 rounded-2xl"
        onClick={() => onPageChange(Math.min(totalPages, page + 1))}
        disabled={page >= totalPages}
        aria-label={nextLabel}
      >
        <ChevronRight className="size-4" />
      </Button>
    </nav>
  );
}
