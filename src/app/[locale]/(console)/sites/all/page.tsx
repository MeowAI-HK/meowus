"use client";

import { Suspense, useEffect, useMemo, useState, type KeyboardEvent, type MouseEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import useSWR from "swr";
import { apiPost, swrFetcher } from "@/lib/api-client";
import { useI18n } from "@/lib/i18n";
import { localizedPath } from "@/lib/i18n-config";
import type { SiteRecord } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  buildPreviewErrorState,
  getSiteGridLayout,
  parseSiteGridLayout,
  previewStatusClass,
  previewShellStatusText,
  siteGridLayouts,
  type BrowserPreviewState,
  type SiteGridLayout,
} from "@/components/sites/shared";

function SitesAllPageContent() {
  const { t, locale } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedLayout = parseSiteGridLayout(searchParams.get("grid"));
  const gridLayout = getSiteGridLayout(selectedLayout);
  const capacity = gridLayout.columns * gridLayout.rows;
  const { data: sitesData } = useSWR<SiteRecord[]>("/api/sites", swrFetcher);
  const sites = useMemo(() => sitesData ?? [], [sitesData]);
  const visibleSites = useMemo(() => sites.slice(0, capacity), [capacity, sites]);
  const hiddenSiteCount = Math.max(sites.length - visibleSites.length, 0);
  const visibleSiteIdsKey = visibleSites.map((site) => site.id).join("|");

  const [notice, setNotice] = useState("");
  const [isStartingAll, setIsStartingAll] = useState(false);
  const [loadingSiteIds, setLoadingSiteIds] = useState<string[]>([]);
  const [previewBySiteId, setPreviewBySiteId] = useState<Record<string, BrowserPreviewState>>({});

  useEffect(() => {
    if (visibleSites.length === 0) {
      window.queueMicrotask(() => setPreviewBySiteId({}));
      return;
    }

    let isCancelled = false;

    const refreshPreviewStates = async () => {
      const previews = await Promise.all(
        visibleSites.map(async (site) => {
          try {
            const nextState = await swrFetcher<BrowserPreviewState>(`/api/browser-profiles/${site.id}/preview`);
            return [site.id, nextState] as const;
          } catch (error) {
            return [
              site.id,
              buildPreviewErrorState(
                site,
                site.id,
                error instanceof Error ? error.message : t("browserPreviewFailed"),
              ),
            ] as const;
          }
        }),
      );

      if (isCancelled) return;
      const nextState: Record<string, BrowserPreviewState> = {};
      for (const [siteId, previewState] of previews) {
        nextState[siteId] = previewState;
      }
      setPreviewBySiteId(nextState);
    };

    void refreshPreviewStates();
    const timer = window.setInterval(() => void refreshPreviewStates(), 1000);
    return () => {
      isCancelled = true;
      window.clearInterval(timer);
    };
  }, [t, visibleSiteIdsKey, visibleSites]);

  function updateGridLayout(layout: SiteGridLayout) {
    router.push(localizedPath(locale, `/sites/all?grid=${layout}`));
  }

  async function refreshSitePreview(site: SiteRecord) {
    try {
      const nextState = await swrFetcher<BrowserPreviewState>(`/api/browser-profiles/${site.id}/preview`);
      setPreviewBySiteId((current) => ({ ...current, [site.id]: nextState }));
      return nextState;
    } catch (error) {
      const fallbackState = buildPreviewErrorState(
        site,
        site.id,
        error instanceof Error ? error.message : t("browserPreviewFailed"),
      );
      setPreviewBySiteId((current) => ({ ...current, [site.id]: fallbackState }));
      return fallbackState;
    }
  }

  async function startSitePreview(site: SiteRecord, bringToFront: boolean) {
    setLoadingSiteIds((current) => (current.includes(site.id) ? current : [...current, site.id]));
    try {
      await apiPost(`/api/browser-profiles/${site.id}/${bringToFront ? "open" : "preview"}`, {});
      await refreshSitePreview(site);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : t("unknownError");
      setPreviewBySiteId((current) => ({
        ...current,
        [site.id]: buildPreviewErrorState(site, site.id, message),
      }));
      setNotice(message);
      return false;
    } finally {
      setLoadingSiteIds((current) => current.filter((siteId) => siteId !== site.id));
    }
  }

  function openSiteChrome(event: MouseEvent<HTMLButtonElement>, site: SiteRecord) {
    event.stopPropagation();
    void startSitePreview(site, true);
  }

  function handleSiteCardKeyDown(event: KeyboardEvent<HTMLDivElement>, site: SiteRecord) {
    if (event.target !== event.currentTarget || (event.key !== "Enter" && event.key !== " ")) return;
    event.preventDefault();
    void startSitePreview(site, true);
  }

  async function startVisiblePreviews() {
    if (visibleSites.length === 0) return;

    setIsStartingAll(true);
    setNotice("");
    const results = await Promise.all(visibleSites.map((site) => startSitePreview(site, false)));
    setIsStartingAll(false);
    if (results.every(Boolean)) setNotice(t("allSitesStartNotice"));
  }

  const slots = Array.from({ length: capacity }, (_, index) => visibleSites[index]);

  return (
    <main className="flex h-full min-w-0 flex-col bg-transparent p-3">
      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm">
        <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b bg-background/60 px-4 backdrop-blur-sm sm:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-lg"
              onClick={() => router.push(localizedPath(locale, "/sites/list"))}
              aria-label={t("navSites")}
              title={t("navSites")}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="truncate text-sm font-semibold text-foreground sm:text-base">{t("allSitesTitle")}</h1>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-1 rounded-full border border-border bg-white p-1 md:flex" aria-label={t("allSitesGridLayout")}>
              {siteGridLayouts.map((layout) => (
                <button
                  key={layout.value}
                  type="button"
                  onClick={() => updateGridLayout(layout.value)}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-xs font-medium transition",
                    selectedLayout === layout.value
                      ? "bg-sky-100 text-sky-800"
                      : "text-muted-foreground hover:bg-slate-100 hover:text-slate-900",
                  )}
                >
                  {layout.value}
                </button>
              ))}
            </div>
            <Button size="sm" variant="outline" onClick={startVisiblePreviews} loading={isStartingAll} disabled={visibleSites.length === 0}>
              {isStartingAll ? t("startingAllPreviews") : t("startAllPreviews")}
            </Button>
          </div>
        </header>

        {notice || hiddenSiteCount > 0 ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border/70 px-4 py-2 text-xs text-muted-foreground sm:px-6">
            {notice ? <span>{notice}</span> : null}
            {hiddenSiteCount > 0 ? <span>{t("allSitesOverflow", { hidden: hiddenSiteCount })}</span> : null}
          </div>
        ) : null}

        <div className="min-h-0 flex-1 bg-sky-50/45 p-3">
          <div
            className="grid h-full min-h-[36rem] gap-3"
            style={{
              gridTemplateColumns: `repeat(${gridLayout.columns}, minmax(0, 1fr))`,
              gridTemplateRows: `repeat(${gridLayout.rows}, minmax(0, 1fr))`,
            }}
          >
            {slots.map((site, index) => {
              if (!site) {
                return (
                  <div
                    key={`empty-${index}`}
                    className="grid min-h-0 place-items-center rounded-[24px] border border-dashed border-sky-100 bg-white/70 text-xs text-muted-foreground shadow-sm"
                  >
                    {t("allSitesEmptySlot")}
                  </div>
                );
              }

              const preview = previewBySiteId[site.id];
              const isLoading = loadingSiteIds.includes(site.id);
              const status = isLoading ? "starting" : preview?.status || "idle";
              const frameUrl = preview?.hasFrame && preview.lastFrameAt
                ? `/api/browser-profiles/${site.id}/preview/frame?ts=${preview.lastFrameAt}`
                : "";

              return (
                <div
                  key={site.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => void startSitePreview(site, true)}
                  onKeyDown={(event) => handleSiteCardKeyDown(event, site)}
                  className="group flex min-h-0 flex-col overflow-hidden rounded-[24px] border border-sky-100 bg-white text-left shadow-sm transition hover:border-sky-200 hover:shadow-md"
                  aria-label={`${t("startSitePreview")} ${site.name}`}
                  title={site.name}
                >
                  <div className="flex h-11 shrink-0 items-center justify-between gap-2 border-b border-sky-100 bg-sky-50/70 px-3">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-slate-900">{site.name}</p>
                      <p className="truncate text-[11px] text-slate-500">{preview?.pageUrl || site.url}</p>
                    </div>
                    <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold", previewStatusClass[status])}>
                      {previewShellStatusText[status]}
                    </span>
                  </div>

                  <div className="relative min-h-0 flex-1 bg-white">
                    {frameUrl && status !== "closed" ? (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={frameUrl} alt={`${site.name} ${t("browserPreviewAlt")}`} className="h-full w-full bg-white object-contain" />
                        <span className="pointer-events-none absolute right-2 top-2 rounded-full border border-white/80 bg-white/90 p-1 text-slate-500 shadow-sm opacity-0 transition group-hover:opacity-100">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </span>
                      </>
                    ) : (
                      <div className="relative h-full min-h-[9rem]">
                        {frameUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={frameUrl} alt={`${site.name} ${t("browserPreviewAlt")}`} className="absolute inset-0 h-full w-full bg-white object-contain" />
                        ) : null}
                        <div
                          className={cn(
                            "absolute inset-0 grid place-items-center px-4 text-center text-xs text-muted-foreground",
                            status === "closed" ? "bg-zinc-500/20" : "",
                          )}
                        >
                          <div
                            className={cn(
                              "flex max-w-xs flex-col items-center gap-3 rounded-2xl border px-4 py-5",
                              status === "closed"
                                ? "border-zinc-200 bg-white text-slate-600"
                                : "",
                            )}
                          >
                            <p>
                              {status === "closed"
                                ? t("browserClosed")
                                : status === "error"
                                  ? preview?.error || t("browserError")
                                  : status === "starting"
                                    ? t("browserStarting")
                                    : t("browserWaiting")}
                            </p>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={(event) => void openSiteChrome(event, site)}
                              loading={isLoading}
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
              );
            })}
          </div>
        </div>
      </section>
    </main>
  );
}

export default function SitesAllPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading...</div>}>
      <SitesAllPageContent />
    </Suspense>
  );
}
