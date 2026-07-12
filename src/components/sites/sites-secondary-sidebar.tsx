"use client";

import { ChevronDown, Grid2X2, Plus, Settings } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { SiteRecord } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  type BrowserPreviewState,
  formatSiteUrl,
  type SiteGridLayout,
  siteGridLayouts,
} from "./shared";

type SitesSecondarySidebarProps = {
  title: string;
  hint: string;
  addSiteLabel: string;
  emptyLabel: string;
  notice: string;
  sites: SiteRecord[];
  openBrowserTabIds: string[];
  activePreviewSiteId: string;
  previewLoadingSiteId: string;
  closeNoticeLabel: string;
  gridMenuLabel: string;
  viewAllSitesLabel: string;
  getPreviewStatus: (siteId: string) => BrowserPreviewState["status"];
  onAddSite: () => void;
  onDismissNotice: () => void;
  onSelectSite: (site: SiteRecord) => void;
  onOpenSettings: (site: SiteRecord) => void;
  onSelectGridLayout: (layout: SiteGridLayout) => void;
};

export function SitesSecondarySidebar({
  title,
  hint,
  addSiteLabel,
  emptyLabel,
  notice,
  sites,
  openBrowserTabIds,
  activePreviewSiteId,
  previewLoadingSiteId,
  closeNoticeLabel,
  gridMenuLabel,
  viewAllSitesLabel,
  getPreviewStatus,
  onAddSite,
  onDismissNotice,
  onSelectSite,
  onOpenSettings,
  onSelectGridLayout,
}: SitesSecondarySidebarProps) {
  const [isGridMenuOpen, setIsGridMenuOpen] = useState(false);
  const gridMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isGridMenuOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!gridMenuRef.current?.contains(event.target as Node)) {
        setIsGridMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsGridMenuOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isGridMenuOpen]);

  return (
    <aside className="flex h-full w-64 min-w-0 flex-col bg-gradient-to-b from-sky-50 via-sky-50 to-slate-100">
      <div className="flex h-14 items-center justify-between px-4">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold text-slate-900">{title}</h2>
          <p className="sr-only">{hint}</p>
        </div>
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg" onClick={onAddSite} aria-label={addSiteLabel} title={addSiteLabel}>
            <Plus className="h-4 w-4" />
          </Button>
          <div ref={gridMenuRef} className="relative">
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 rounded-lg"
              onClick={() => setIsGridMenuOpen((current) => !current)}
              aria-label={gridMenuLabel}
              aria-expanded={isGridMenuOpen}
              title={gridMenuLabel}
            >
              <span className="relative flex items-center">
                <Grid2X2 className="h-4 w-4" />
                <ChevronDown className="absolute -right-2.5 -bottom-1 h-3 w-3" />
              </span>
            </Button>
            {isGridMenuOpen ? (
              <div className="absolute right-0 top-10 z-30 w-40 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 text-sm shadow-lg">
                <div className="border-b border-slate-100 px-3 py-2 text-xs font-medium text-slate-500">{viewAllSitesLabel}</div>
                {siteGridLayouts.map((layout) => (
                  <button
                    key={layout.value}
                    type="button"
                    onClick={() => {
                      setIsGridMenuOpen(false);
                      onSelectGridLayout(layout.value);
                    }}
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-slate-700 transition hover:bg-sky-50 hover:text-slate-950"
                  >
                    <span>{layout.value}</span>
                    <span className="text-xs text-slate-400">{layout.columns} x {layout.rows}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {notice ? (
        <div className="mx-3 mt-3 flex items-start justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
          <span>{notice}</span>
          <button
            type="button"
            onClick={onDismissNotice}
            className="rounded px-1 font-semibold text-emerald-700 hover:bg-emerald-100"
            aria-label={closeNoticeLabel}
            title={closeNoticeLabel}
          >
            x
          </button>
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {sites.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
            {emptyLabel}
          </div>
        ) : (
          <div className="space-y-1">
          {sites.map((site) => {
            const isActive = activePreviewSiteId === site.id;
            const previewStatus = getPreviewStatus(site.id);
            const isLoading = previewLoadingSiteId === site.id;
            const isOpen = openBrowserTabIds.includes(site.id);

            return (
              <div
                key={site.id}
                className={cn(
                  "group flex items-center gap-1 text-sm transition-all duration-200",
                  isActive ? "rounded-2xl px-5 py-3.5 flex-1 min-w-0 bg-[#5B8DEF] text-white shadow-sm" : "rounded-lg px-2 py-1.5 text-slate-700 hover:bg-slate-200/50 hover:text-slate-900",
                  isLoading && "opacity-70",
                )}
              >
                <button
                  type="button"
                  onClick={() => onSelectSite(site)}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  title={site.url || site.name}
                >
                  <span
                    className={cn(
                      "h-2 w-2 shrink-0 rounded-full",
                      previewStatus === "ready"
                        ? isActive ? "bg-emerald-200" : "bg-emerald-500"
                        : previewStatus === "error"
                          ? isActive ? "bg-rose-200" : "bg-rose-500"
                          : site.status === "needs_login"
                            ? isActive ? "bg-amber-200" : "bg-amber-400"
                            : isActive ? "bg-white/70" : "bg-slate-300",
                    )}
                  />
                  <span className={cn("truncate", isActive && "font-medium text-white")}>{site.name}</span>
                  {isOpen ? <span className="sr-only">Open</span> : null}
                </button>

                <button
                  type="button"
                  onClick={() => onOpenSettings(site)}
                  className={cn(
                    "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-400 transition",
                    isActive
                      ? "text-white/85 opacity-100 hover:bg-white/15 hover:text-white"
                      : "hover:bg-slate-200/70 hover:text-slate-700 opacity-0 group-hover:opacity-100 focus:opacity-100",
                  )}
                  aria-label={`${title} ${site.name}`}
                  title={formatSiteUrl(site.url)}
                >
                  <Settings className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
          </div>
        )}
      </div>
    </aside>
  );
}
