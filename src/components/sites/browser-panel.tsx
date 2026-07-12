"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ExternalLink, Grid2X2, Info, X } from "lucide-react";
import type { SiteRecord } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import { localizedPath } from "@/lib/i18n-config";
import {
  type BrowserPreviewState,
  previewShellStatusText,
  profileLabelFromPath,
} from "./shared";

export type BrowserPanelTab = {
  site: SiteRecord;
  status: BrowserPreviewState["status"];
};

export type BrowserPanelProps = {
  tabs: BrowserPanelTab[];
  activePreview: BrowserPreviewState | undefined;
  activePreviewSite: SiteRecord | undefined;
  activePreviewSiteId: string;
  activePreviewStatus: BrowserPreviewState["status"];
  activePreviewFrameUrl: string;
  onSelectSite: (siteId: string) => void;
  onCloseTab: (site: SiteRecord) => void | Promise<void>;
  onPreviewClick: () => void | Promise<void>;
  className?: string;
};

export function BrowserPanel({
  tabs,
  activePreview,
  activePreviewSite,
  activePreviewSiteId,
  activePreviewStatus,
  activePreviewFrameUrl,
  onSelectSite,
  onCloseTab,
  onPreviewClick,
  className,
}: BrowserPanelProps) {
  const { t, locale } = useI18n();
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const infoMenuRef = useRef<HTMLDivElement | null>(null);
  const activeProfileLabel = profileLabelFromPath(activePreview?.profilePath || activePreviewSite?.profilePath);
  const activeProfileDirectory = activePreview?.profilePath || activePreviewSite?.profilePath || t("notConfigured");
  const activeStatusDotClass =
    activePreviewStatus === "ready"
      ? "bg-emerald-400"
      : activePreviewStatus === "error" || activePreviewStatus === "closed"
        ? "bg-red-400"
        : activePreviewStatus === "starting"
          ? "bg-amber-300"
          : "bg-zinc-400";

  useEffect(() => {
    if (!isInfoOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!infoMenuRef.current?.contains(event.target as Node)) {
        setIsInfoOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsInfoOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isInfoOpen]);

  return (
    <section className={cn("h-full min-h-[32rem] min-w-0 lg:min-h-full", className)}>
      <div className="flex h-full min-h-full flex-col overflow-hidden bg-card">
        <div className="bg-card px-2 pt-2">
          <div className="flex items-end gap-2 overflow-x-auto pb-0.5">
            <Link
              href={localizedPath(locale, "/sites/all")}
              className="mb-0.5 flex size-9 shrink-0 items-center justify-center rounded-2xl text-gray-400 transition hover:bg-sky-100 hover:text-sky-900"
              aria-label={t("siteGridMenu")}
              title={t("siteGridMenu")}
            >
              <Grid2X2 className="size-4" />
            </Link>
            {tabs.length === 0 ? (
              <div className="px-3 py-2 text-xs text-muted-foreground">{t("noBrowserTabs")}</div>
            ) : (
              tabs.map(({ site, status }) => {
                const isActive = activePreviewSiteId === site.id;
                return (
                  <div
                    key={site.id}
                    className={cn(
                      "flex min-w-[12rem] items-center gap-2 rounded-t-[18px] border border-transparent px-3 py-2 transition",
                      isActive
                        ? "-mb-px bg-sky-50 text-sky-900"
                        : "border-transparent bg-white text-slate-500 hover:bg-slate-50",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => onSelectSite(site.id)}
                      className="flex min-w-0 flex-1 items-center gap-2 text-left"
                    >
                      <span
                        className={cn(
                          "size-2 rounded-full",
                          status === "ready"
                            ? "bg-emerald-400"
                            : status === "error" || status === "closed"
                              ? "bg-red-400"
                              : status === "starting"
                                ? "bg-amber-300"
                                : "bg-zinc-400",
                        )}
                      />
                      <span className="truncate text-sm font-medium">{site.name}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => void onCloseTab(site)}
                      className="rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                      aria-label={`${t("dlgClose")} ${site.name}`}
                    >
                      <X size={13} />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="border-b border-border bg-sky-50 px-4 py-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-[#ffb4aa]" />
              <span className="size-2.5 rounded-full bg-[#ffd98f]" />
              <span className="size-2.5 rounded-full bg-[#8fd8a7]" />
            </div>
            <div className="flex min-w-0 flex-1 items-center gap-2 rounded-full border border-sky-200 bg-sky-100/80 px-2.5 py-1.5 text-xs text-sky-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]">
              <div ref={infoMenuRef} className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => setIsInfoOpen((current) => !current)}
                  className="relative flex size-7 items-center justify-center rounded-full text-sky-700 transition hover:bg-white/70 hover:text-sky-950"
                  aria-label={t("browserInfo")}
                  aria-expanded={isInfoOpen}
                  title={t("browserInfo")}
                >
                  <Info className="size-4" />
                  <span className={cn("absolute right-1 top-1 size-2 rounded-full ring-2 ring-sky-100", activeStatusDotClass)} />
                </button>

                {isInfoOpen ? (
                  <div className="absolute left-0 top-full z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-sky-100 bg-white text-left text-xs text-slate-600 shadow-xl">
                    <div className="border-b border-slate-100 px-4 py-3">
                      <div className="flex items-center gap-2 font-semibold text-slate-900">
                        <span className={cn("size-2 rounded-full", activeStatusDotClass)} />
                        <span>{previewShellStatusText[activePreviewStatus]}</span>
                      </div>
                    </div>
                    <div className="space-y-3 px-4 py-3">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">{t("setupId")}</p>
                        <p className="mt-1 break-all font-medium text-slate-800">{activeProfileLabel}</p>
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">{t("directory")}</p>
                        <p className="mt-1 break-all text-slate-600">{activeProfileDirectory}</p>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
              <span className="block min-w-0 flex-1 truncate px-1">{activePreview?.pageUrl || "about:blank"}</span>
            </div>
            {activePreviewSiteId ? (
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  className="w-8 px-0"
                  onClick={() => void onPreviewClick()}
                  aria-label={t("openChrome")}
                  title={t("openChrome")}
                >
                  <ExternalLink size={14} />
                </Button>
              </div>
            ) : null}
          </div>
        </div>

        <div className="relative min-h-0 flex-1 bg-sky-50/45">
          {!activePreviewSiteId ? (
            <div className="grid h-full min-h-[24rem] place-items-center rounded-[28px] border border-sky-100 bg-white/80 px-6 text-center text-sm text-muted-foreground shadow-sm">
              {t("noActiveBrowser")}
            </div>
          ) : activePreviewFrameUrl && activePreviewStatus !== "closed" ? (
            <button
              type="button"
              onClick={() => void onPreviewClick()}
              className="group relative h-full w-full overflow-hidden border border-sky-100 bg-white text-left shadow-sm"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={activePreviewFrameUrl}
                alt={`${activePreviewSite?.name || t("browserLabel")} ${t("browserPreviewAlt")}`}
                className="h-full w-full bg-white object-contain transition duration-200 group-hover:scale-[1.004]"
              />
              <div className="pointer-events-none absolute left-4 top-4 rounded-full border border-white/80 bg-white/88 px-3 py-1 text-xs font-medium text-slate-700 shadow-sm">
                {activePreviewSite?.name || t("browserLabel")}
              </div>
              <div className="pointer-events-none absolute right-4 top-4 rounded-full border border-white/80 bg-white/88 px-3 py-1 text-xs font-medium text-slate-600 shadow-sm">
                {t("clickToTakeOverChrome")}
              </div>
            </button>
          ) : (
            <div className="relative h-full">
              {activePreviewFrameUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={activePreviewFrameUrl}
                  alt={`${activePreviewSite?.name || t("browserLabel")} ${t("browserPreviewAlt")}`}
                  className="absolute inset-0 h-full w-full bg-white object-contain"
                />
              ) : null}
              <div
                className={cn(
                  "absolute inset-0 grid place-items-center px-6",
                  activePreviewStatus === "closed" ? "bg-zinc-500/20" : "bg-card",
                )}
              >
                <div
                  className={cn(
                    "flex max-w-sm flex-col items-center gap-4 rounded-[28px] border px-6 py-8 text-center shadow-sm",
                    activePreviewStatus === "closed"
                      ? "border-zinc-200 bg-white"
                      : "border-sky-100 bg-sky-50/60",
                  )}
                >
                  <p className="text-sm text-slate-600">
                    {activePreviewStatus === "closed"
                      ? t("browserClosed")
                      : activePreviewStatus === "error"
                        ? activePreview?.error || t("browserError")
                        : activePreviewStatus === "starting"
                          ? t("browserStarting")
                          : t("browserWaiting")}
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => void onPreviewClick()}
                    loading={activePreviewStatus === "starting"}
                    className="border-sky-200 bg-white text-sky-700 hover:bg-sky-100"
                  >
                    {t("openChrome")}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
