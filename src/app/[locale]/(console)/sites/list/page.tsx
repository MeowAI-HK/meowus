"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import type { SiteRecord } from "@/lib/types";
import { useI18n } from "@/lib/i18n";
import { apiDelete, apiPatch, apiPost, swrFetcher } from "@/lib/api-client";
import { localizedPath } from "@/lib/i18n-config";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { AgentChatPanel } from "@/components/agent-chat/agent-chat-panel";
import { BrowserPanel } from "@/components/sites/browser-panel";
import { SitesBrowserBottomSheet } from "@/components/sites/browser-bottom-sheet";
import { SitesWorkspace } from "@/components/sites/sites-workspace";
import { useSitesBrowserSheet } from "@/components/sites/browser-sheet-context";
import { SiteFormFields } from "@/components/sites/site-form-fields";
import {
  BROWSER_ACTIVE_TAB_STORAGE_KEY,
  BROWSER_TABS_STORAGE_KEY,
  buildPreviewErrorState,
  createEmptySiteForm,
  parseStoredTabIds,
  profileLabelFromPath,
  type BrowserPreviewState,
  type SiteFormState,
} from "@/components/sites/shared";

function SitesListPageContent() {
  const { t, locale } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isOpen: isBrowserSheetOpen, openSheet, closeSheet } = useSitesBrowserSheet();
  const { data: sitesData, mutate: reloadSites } = useSWR<SiteRecord[]>("/api/sites", swrFetcher);
  const sites = useMemo(() => sitesData ?? [], [sitesData]);
  const hasLoadedSites = sitesData !== undefined;

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [activePreviewSiteId, setActivePreviewSiteId] = useState("");
  const [openBrowserTabIds, setOpenBrowserTabIds] = useState<string[]>([]);
  const [previewLoadingSiteId, setPreviewLoadingSiteId] = useState("");
  const [previewBySiteId, setPreviewBySiteId] = useState<Record<string, BrowserPreviewState>>({});
  const [hasHydratedTabs, setHasHydratedTabs] = useState(false);
  const [editingSiteId, setEditingSiteId] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);
  const [siteForm, setSiteForm] = useState<SiteFormState>(createEmptySiteForm());
  const [settingsForm, setSettingsForm] = useState<SiteFormState>(createEmptySiteForm());

  function replaceWorkspaceParams(siteId: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("newChat");
    if (siteId) {
      params.set("siteId", siteId);
      params.set("browserTab", siteId);
    } else {
      params.delete("siteId");
      params.delete("browserTab");
    }
    const query = params.toString();
    router.replace(localizedPath(locale, query ? `/sites/list?${query}` : "/sites/list"), { scroll: false });
  }

  function closeAddSiteDialog() {
    setIsAddOpen(false);
    if (searchParams.get("addSite") !== "1") return;
    const params = new URLSearchParams(searchParams.toString());
    params.delete("addSite");
    const query = params.toString();
    router.replace(localizedPath(locale, query ? `/sites/list?${query}` : "/sites/list"), { scroll: false });
  }

  function getPreviewStatus(siteId: string): BrowserPreviewState["status"] {
    if (!siteId) return "idle";
    if (previewLoadingSiteId === siteId) return "starting";
    return previewBySiteId[siteId]?.status || "idle";
  }

  function handleSelectPreviewSite(siteId: string) {
    setActivePreviewSiteId(siteId);
    replaceWorkspaceParams(siteId);
  }

  useEffect(() => {
    if (!hasLoadedSites || hasHydratedTabs) return;

    const validSiteIds = new Set(sites.map((site) => site.id));
    const storedTabs = parseStoredTabIds(window.localStorage.getItem(BROWSER_TABS_STORAGE_KEY))
      .filter((siteId) => validSiteIds.has(siteId));
    const storedActiveSiteId = window.localStorage.getItem(BROWSER_ACTIVE_TAB_STORAGE_KEY) || "";
    const requestedSiteId = searchParams.get("siteId") || searchParams.get("browserTab") || "";
    const activeSiteId = requestedSiteId && validSiteIds.has(requestedSiteId)
      ? requestedSiteId
      : storedActiveSiteId && storedTabs.includes(storedActiveSiteId)
        ? storedActiveSiteId
        : storedTabs[0] || "";

    window.queueMicrotask(() => {
      setOpenBrowserTabIds(storedTabs);
      setActivePreviewSiteId(activeSiteId);
      setHasHydratedTabs(true);
    });
  }, [hasHydratedTabs, hasLoadedSites, searchParams, sites]);

  useEffect(() => {
    if (!hasHydratedTabs) return;
    const requestedSiteId = searchParams.get("siteId") || searchParams.get("browserTab") || "";
    if (!requestedSiteId || requestedSiteId === activePreviewSiteId) return;
    if (!sites.some((site) => site.id === requestedSiteId)) return;

    window.queueMicrotask(() => {
      setActivePreviewSiteId(requestedSiteId);
      setOpenBrowserTabIds((current) => (current.includes(requestedSiteId) ? current : [...current, requestedSiteId]));
    });
  }, [activePreviewSiteId, hasHydratedTabs, searchParams, sites]);

  useEffect(() => {
    if (searchParams.get("addSite") !== "1") return;
    window.queueMicrotask(() => setIsAddOpen(true));
  }, [searchParams]);

  useEffect(() => {
    if (!hasHydratedTabs) return;
    window.localStorage.setItem(BROWSER_TABS_STORAGE_KEY, JSON.stringify(openBrowserTabIds));

    if (activePreviewSiteId && openBrowserTabIds.includes(activePreviewSiteId)) {
      window.localStorage.setItem(BROWSER_ACTIVE_TAB_STORAGE_KEY, activePreviewSiteId);
      return;
    }
    window.localStorage.removeItem(BROWSER_ACTIVE_TAB_STORAGE_KEY);
  }, [activePreviewSiteId, hasHydratedTabs, openBrowserTabIds]);

  useEffect(() => {
    if (!hasHydratedTabs) return;
    const validSiteIds = new Set(sites.map((site) => site.id));
    window.queueMicrotask(() => {
      setOpenBrowserTabIds((current) => current.filter((siteId) => validSiteIds.has(siteId)));
      setPreviewBySiteId((current) => {
        const nextState: Record<string, BrowserPreviewState> = {};
        for (const [siteId, previewState] of Object.entries(current)) {
          if (validSiteIds.has(siteId)) nextState[siteId] = previewState;
        }
        return nextState;
      });
    });
  }, [hasHydratedTabs, sites]);

  useEffect(() => {
    if (!editingSiteId) return;
    if (sites.some((site) => site.id === editingSiteId)) return;
    window.queueMicrotask(() => {
      setIsSettingsOpen(false);
      setEditingSiteId("");
      setSettingsForm(createEmptySiteForm());
    });
  }, [editingSiteId, sites]);

  const openBrowserTabsKey = openBrowserTabIds.join("|");

  useEffect(() => {
    if (!hasHydratedTabs) return;
    if (openBrowserTabIds.length === 0) {
      window.queueMicrotask(() => setPreviewBySiteId({}));
      return;
    }

    let isCancelled = false;

    const refreshPreviewStates = async () => {
      const previews = await Promise.all(
        openBrowserTabIds.map(async (siteId) => {
          const site = sites.find((candidate) => candidate.id === siteId);
          try {
            const nextState = await swrFetcher<BrowserPreviewState>(`/api/browser-profiles/${siteId}/preview`);
            return [siteId, nextState] as const;
          } catch (error) {
            return [
              siteId,
              buildPreviewErrorState(
                site,
                siteId,
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
  }, [hasHydratedTabs, openBrowserTabIds, openBrowserTabsKey, sites, t]);

  const activePreview = activePreviewSiteId ? previewBySiteId[activePreviewSiteId] : undefined;
  const activePreviewSite = sites.find((site) => site.id === activePreviewSiteId);
  const editingSite = sites.find((site) => site.id === editingSiteId);
  const editingPreview = editingSiteId ? previewBySiteId[editingSiteId] : undefined;
  const activePreviewFrameUrl =
    activePreviewSiteId && activePreview?.hasFrame && activePreview.lastFrameAt
      ? `/api/browser-profiles/${activePreviewSiteId}/preview/frame?ts=${activePreview.lastFrameAt}`
      : "";
  const openBrowserTabs = openBrowserTabIds
    .map((siteId) => sites.find((site) => site.id === siteId))
    .filter((site): site is SiteRecord => Boolean(site));
  const browserTabs = openBrowserTabs.map((site) => ({
    site,
    status: getPreviewStatus(site.id),
  }));

  async function syncPreviewState(site: SiteRecord) {
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

  async function runAction(action: () => Promise<void>) {
    try {
      await action();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : t("unknownError"));
    }
  }

  async function handleCreateSite() {
    await runAction(async () => {
      const site = await apiPost<SiteRecord>("/api/sites", siteForm);
      setNotice(t("siteCreatedNotice", { name: site.name }));
      setSiteForm(createEmptySiteForm());
      closeAddSiteDialog();
      await reloadSites();
    });
  }

  function closeSiteSettings() {
    setIsSettingsOpen(false);
    setEditingSiteId("");
    setSettingsForm(createEmptySiteForm());
  }

  async function handleSaveSiteSettings() {
    if (!editingSiteId) return;

    setSavingSettings(true);
    try {
      const updatedSite = await apiPatch<SiteRecord>(`/api/sites/${editingSiteId}`, settingsForm);
      setNotice(`${t("siteUpdated")}${updatedSite.name}`);
      closeSiteSettings();
      await reloadSites();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : t("siteUpdateFailed"));
    } finally {
      setSavingSettings(false);
    }
  }

  async function handleOpenBrowser(site: SiteRecord, options: { quiet?: boolean } = {}) {
    setPreviewLoadingSiteId(site.id);
    setOpenBrowserTabIds((current) => (current.includes(site.id) ? current : [...current, site.id]));
    setActivePreviewSiteId(site.id);
    replaceWorkspaceParams(site.id);

    try {
      await apiPost(`/api/browser-profiles/${site.id}/open`, {});
      await syncPreviewState(site);
      if (window.matchMedia("(max-width: 767px)").matches) openSheet();
      if (!options.quiet) setNotice(t("browserOpenedNotice"));
    } catch (error) {
      const message = error instanceof Error ? error.message : t("unknownError");
      setPreviewBySiteId((current) => ({
        ...current,
        [site.id]: buildPreviewErrorState(site, site.id, message),
      }));
      setNotice(message);
    } finally {
      setPreviewLoadingSiteId("");
    }
  }

  async function handlePreviewClick() {
    if (!activePreviewSite) return;
    await handleOpenBrowser(activePreviewSite, { quiet: true });
  }

  async function handleCloseBrowserTab(site: SiteRecord) {
    await runAction(async () => {
      await apiDelete(`/api/browser-profiles/${site.id}/preview`);
      const remainingTabs = openBrowserTabIds.filter((siteId) => siteId !== site.id);
      setOpenBrowserTabIds(remainingTabs);
      if (activePreviewSiteId === site.id) {
        const nextSiteId = remainingTabs[0] || "";
        setActivePreviewSiteId(nextSiteId);
        replaceWorkspaceParams(nextSiteId);
      }
      setPreviewBySiteId((current) => {
        const nextState = { ...current };
        delete nextState[site.id];
        return nextState;
      });
    });
  }

  const activePreviewStatus = getPreviewStatus(activePreviewSiteId);
  const chatPanel = (
    <AgentChatPanel
      sites={sites}
      activeSiteId={activePreviewSiteId}
      initialThreadId={searchParams.get("threadId") || ""}
      draftToken={searchParams.get("newChat") || ""}
      onTargetSiteSelected={(site) => handleOpenBrowser(site, { quiet: true })}
    />
  );

  const browserPanel = (
    <BrowserPanel
      tabs={browserTabs}
      activePreview={activePreview}
      activePreviewSite={activePreviewSite}
      activePreviewSiteId={activePreviewSiteId}
      activePreviewStatus={activePreviewStatus}
      activePreviewFrameUrl={activePreviewFrameUrl}
      onSelectSite={handleSelectPreviewSite}
      onCloseTab={handleCloseBrowserTab}
      onPreviewClick={handlePreviewClick}
    />
  );

  return (
    <div className="flex h-full min-w-0 bg-transparent">
      <main className="flex min-w-0 flex-1 flex-col bg-card pb-0 md:m-3 md:overflow-hidden md:rounded-lg md:border md:border-border md:shadow-sm">
        <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b bg-background/60 px-4 backdrop-blur-sm sm:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <h1 className="truncate text-sm font-semibold text-foreground sm:text-base">{t("navSites")}</h1>
          </div>
          <Button variant="outline" size="sm" className="md:hidden" onClick={openSheet}>
            {t("browserLabel")}
          </Button>
        </header>

        {notice ? (
          <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800 sm:px-6">
            {notice}
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-hidden">
          <SitesWorkspace
            chatPanel={chatPanel}
            browserPanel={browserPanel}
            mobileBrowserSheet={
              <SitesBrowserBottomSheet
                open={isBrowserSheetOpen}
                onClose={closeSheet}
                title={activePreviewSite?.name ? `${activePreviewSite.name} ${t("browserLabel")}` : t("browserLabel")}
                tabs={browserTabs}
                activePreview={activePreview}
                activePreviewSite={activePreviewSite}
                activePreviewSiteId={activePreviewSiteId}
                activePreviewStatus={activePreviewStatus}
                activePreviewFrameUrl={activePreviewFrameUrl}
                onSelectSite={handleSelectPreviewSite}
                onCloseTab={handleCloseBrowserTab}
                onPreviewClick={handlePreviewClick}
              />
            }
          />
        </div>
      </main>

      <Dialog open={isAddOpen} onClose={closeAddSiteDialog} title={t("addSite")}>
        <div className="space-y-4">
          <SiteFormFields form={siteForm} onChange={setSiteForm} updateUrlOnPlatformChange />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={closeAddSiteDialog}>{t("dlgCancel")}</Button>
            <Button disabled={!siteForm.name.trim()} onClick={handleCreateSite}>{t("btnCreateSite")}</Button>
          </div>
        </div>
      </Dialog>

      <Dialog
        open={isSettingsOpen}
        onClose={closeSiteSettings}
        title={editingSite ? `${editingSite.name} ${t("siteSettings")}` : t("siteSettings")}
        maxWidth="lg"
      >
        <div className="space-y-5">
          <SiteFormFields form={settingsForm} onChange={setSettingsForm} includeStatus />

          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-4 text-sm text-zinc-600">
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">{t("browserProfileId")}</p>
                <p className="mt-1 break-all font-medium text-zinc-800">{editingSite ? profileLabelFromPath(editingSite.profilePath) : "-"}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">{t("directory")}</p>
                <p className="mt-1 break-all text-zinc-600">{editingSite?.profilePath || "-"}</p>
              </div>
              <div className="md:col-span-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">{t("browserUrl")}</p>
                <p className="mt-1 break-all text-zinc-600">{editingPreview?.pageUrl || t("noBrowserSession")}</p>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={closeSiteSettings}>{t("dlgCancel")}</Button>
            <Button onClick={handleSaveSiteSettings} loading={savingSettings}>{t("saveSettings")}</Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}

export default function SitesListPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading...</div>}>
      <SitesListPageContent />
    </Suspense>
  );
}
