"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { Bot, Globe2, LayoutGrid, List, Plus, Search, X } from "lucide-react";
import type { ContentItem, ContentPage } from "@/lib/types";
import { useI18n } from "@/lib/i18n";
import { apiPost, swrFetcher } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useConsoleHeaderActions } from "@/components/ui/console-header-actions";
import { ConsolePagination, useClampConsolePage } from "@/components/ui/console-pagination";
import { ConsoleNotice, consoleInputClass } from "@/components/ui/console-surface";

function imageUrl(imagePath?: string) {
  if (!imagePath) return "";
  if (/^https?:\/\//i.test(imagePath)) return imagePath;
  const fileName = imagePath.split(/[\\/]/).pop() ?? "";
  return fileName ? `/api/agent/artifacts?file=${encodeURIComponent(fileName)}` : "";
}

function metadataString(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key];
  return typeof value === "string" && value.trim() ? value : "";
}

const CONTENT_VIEW_STORAGE_KEY = "content-library-view";
type ContentView = "grid" | "list";

export default function ContentLibraryPage() {
  const { t } = useI18n();
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);
  const [view, setView] = useState<ContentView>("grid");
  const contentUrl = useMemo(() => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("pageSize", "20");
    if (search.trim()) params.set("q", search.trim());
    if (fromDate) params.set("from", String(new Date(`${fromDate}T00:00:00`).getTime()));
    if (toDate) params.set("to", String(new Date(`${toDate}T23:59:59.999`).getTime()));
    const query = params.toString();
    return query ? `/api/content?${query}` : "/api/content";
  }, [fromDate, page, search, toDate]);
  const { data, mutate: reloadContent } = useSWR<ContentPage>(contentUrl, swrFetcher, { refreshInterval: 5000 });
  const content = data?.items ?? [];
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ContentItem | null>(null);
  const [activeTab, setActiveTab] = useState<"ai" | "url">("ai");
  const [notice, setNotice] = useState("");
  const [topic, setTopic] = useState("");
  const [prompt, setPrompt] = useState("");
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const totalItems = data?.total ?? 0;
  const safePage = data?.page ?? page;
  useClampConsolePage(page, totalItems, setPage);
  const hasFilters = Boolean(search.trim() || fromDate || toDate);

  useEffect(() => {
    const storedView = window.localStorage.getItem(CONTENT_VIEW_STORAGE_KEY);
    if (storedView === "grid" || storedView === "list") {
      window.queueMicrotask(() => setView(storedView));
    }
  }, []);

  function selectView(nextView: ContentView) {
    setView(nextView);
    window.localStorage.setItem(CONTENT_VIEW_STORAGE_KEY, nextView);
  }

  function openContentItem(item: ContentItem) {
    setSelectedItem(item);
  }

  const headerActions = useMemo(() => (
    <Button onClick={() => setIsAddOpen(true)}>
      <Plus size={16} />
      {t("addContent")}
    </Button>
  ), [t]);
  useConsoleHeaderActions(headerActions);

  async function runAction(action: () => Promise<void>) {
    setLoading(true);
    try {
      await action();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : t("unknownError"));
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerate() {
    await runAction(async () => {
      const result = await apiPost<{ item: ContentItem }>("/api/content/generate", {
        topic, prompt, language: "Traditional Chinese", maxWords: 300,
      });
      setNotice(t("contentReadyNotice", { title: result.item.title }));
      setTopic(""); setPrompt(""); setIsAddOpen(false);
      await reloadContent();
    });
  }

  async function handleImportUrl() {
    await runAction(async () => {
      const result = await apiPost<{ item: ContentItem }>("/api/content/import-url", {
        url, rewrite: true, language: "Traditional Chinese", maxWords: 300,
      });
      setNotice(t("contentReadyNotice", { title: result.item.title }));
      setUrl(""); setIsAddOpen(false);
      await reloadContent();
    });
  }

  const selectedImageUrl = imageUrl(selectedItem?.imagePath);

  return (
    <div className="space-y-6">
      {notice ? <ConsoleNotice message={notice} onDismiss={() => setNotice("")} /> : null}

      <section className="space-y-4">
        <div className="flex flex-col gap-2 rounded-2xl border border-sky-100 bg-sky-50/40 p-3 lg:flex-row lg:items-center">
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">{t("contentSearchTitle")}</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
            <input
              type="search"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder={t("contentSearchPlaceholder")}
              className={`${consoleInputClass} pl-9`}
            />
          </label>
          <label className="flex min-h-10 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 text-xs font-medium text-zinc-500 lg:w-48">
            <span className="shrink-0">{t("contentDateFrom")}</span>
            <input
              type="date"
              value={fromDate}
              onChange={(event) => {
                setFromDate(event.target.value);
                setPage(1);
              }}
              className="min-w-0 flex-1 bg-transparent text-sm text-zinc-900 outline-none"
            />
          </label>
          <label className="flex min-h-10 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 text-xs font-medium text-zinc-500 lg:w-48">
            <span className="shrink-0">{t("contentDateTo")}</span>
            <input
              type="date"
              value={toDate}
              onChange={(event) => {
                setToDate(event.target.value);
                setPage(1);
              }}
              className="min-w-0 flex-1 bg-transparent text-sm text-zinc-900 outline-none"
            />
          </label>
          <Button
            variant="ghost"
            disabled={!hasFilters}
            onClick={() => {
              setSearch("");
              setFromDate("");
              setToDate("");
              setPage(1);
            }}
          >
            <X size={15} />
            {t("contentClearFilters")}
          </Button>
          <div className="flex h-10 shrink-0 items-center rounded-lg border border-zinc-200 bg-white p-1" role="group" aria-label={t("contentViewMode")}>
            <button
              type="button"
              onClick={() => selectView("grid")}
              className={`grid size-8 place-items-center rounded-md transition ${view === "grid" ? "bg-sky-100 text-sky-700" : "text-zinc-500 hover:bg-zinc-100"}`}
              aria-label={t("contentGridView")}
              aria-pressed={view === "grid"}
              title={t("contentGridView")}
            >
              <LayoutGrid size={16} />
            </button>
            <button
              type="button"
              onClick={() => selectView("list")}
              className={`grid size-8 place-items-center rounded-md transition ${view === "list" ? "bg-sky-100 text-sky-700" : "text-zinc-500 hover:bg-zinc-100"}`}
              aria-label={t("contentListView")}
              aria-pressed={view === "list"}
              title={t("contentListView")}
            >
              <List size={16} />
            </button>
          </div>
        </div>
        {totalItems === 0 ? (
          <p className="border-y border-dashed border-border py-6 text-center text-sm text-zinc-500">
            {hasFilters ? t("contentNoFilterResults") : t("emptyContent")}
          </p>
        ) : view === "grid" ? (
          <div className="grid gap-4 md:grid-cols-2">
            {content.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => openContentItem(item)}
                className="flex min-h-40 flex-col justify-between border-b border-border py-4 text-left transition hover:bg-sky-50/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
              >
                <div className="flex min-w-0 gap-3">
                  {imageUrl(item.imagePath) ? (
                    <div className="size-24 shrink-0 overflow-hidden rounded-2xl border border-zinc-100 bg-zinc-50">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={imageUrl(item.imagePath)} alt="" className="h-full w-full object-cover" />
                    </div>
                  ) : null}
                  <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="min-w-0 flex-1 truncate font-semibold text-zinc-900">{item.title || t("contentNoValue")}</h3>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${item.status === "ready" ? "bg-emerald-100 text-emerald-700" : "bg-zinc-100 text-zinc-600"}`}>
                      {item.status === "ready" ? t("ready") : t("draft")}
                    </span>
                  </div>
                  <p className="line-clamp-3 text-sm leading-relaxed text-zinc-600">{item.postReadyText || item.body}</p>
                  </div>
                </div>
                <div className="mt-3 text-right text-xs text-zinc-400">{new Date(item.createdAt).toLocaleDateString()}</div>
              </button>
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white">
            <table className="w-full min-w-[760px] border-collapse text-left text-sm">
              <thead className="bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                <tr>
                  <th scope="col" className="px-4 py-3">{t("contentTableContent")}</th>
                  <th scope="col" className="px-4 py-3">{t("contentTableExcerpt")}</th>
                  <th scope="col" className="px-4 py-3">{t("status")}</th>
                  <th scope="col" className="px-4 py-3">{t("contentCreatedAt")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {content.map((item) => (
                  <tr
                    key={item.id}
                    className="cursor-pointer transition hover:bg-sky-50/50 focus-within:bg-sky-50/50"
                    onClick={() => openContentItem(item)}
                  >
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => openContentItem(item)}
                        className="flex max-w-xs items-center gap-3 text-left font-semibold text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                      >
                        {imageUrl(item.imagePath) ? (
                          <span className="size-12 shrink-0 overflow-hidden rounded-xl border border-zinc-100 bg-zinc-50">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={imageUrl(item.imagePath)} alt="" className="h-full w-full object-cover" />
                          </span>
                        ) : null}
                        <span className="line-clamp-2">{item.title || t("contentNoValue")}</span>
                      </button>
                    </td>
                    <td className="max-w-md px-4 py-3 text-zinc-600">
                      <p className="line-clamp-2">{item.postReadyText || item.body}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${item.status === "ready" ? "bg-emerald-100 text-emerald-700" : "bg-zinc-100 text-zinc-600"}`}>
                        {item.status === "ready" ? t("ready") : t("draft")}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-zinc-500">{new Date(item.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <ConsolePagination
          page={safePage}
          totalItems={totalItems}
          onPageChange={setPage}
          ariaLabel={t("paginationLabel")}
          previousLabel={t("paginationPrevious")}
          nextLabel={t("paginationNext")}
        />
      </section>

      <Dialog open={isAddOpen} onClose={() => setIsAddOpen(false)} title={t("addContent")}>
        <div className="mb-4 flex gap-1 rounded-lg bg-zinc-100 p-1">
          {(["ai", "url"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 rounded-md py-1.5 text-xs font-semibold transition ${
                activeTab === tab ? "bg-white text-zinc-950 shadow-sm" : "text-zinc-500 hover:text-zinc-800"
              }`}
            >
              {tab === "ai" ? t("btnAiGenerate") : t("importUrl")}
            </button>
          ))}
        </div>

        {activeTab === "ai" ? (
          <div className="space-y-4">
            <label className="grid gap-1.5 text-sm font-medium text-zinc-700">
              <span>{t("contentTopic")}</span>
              <input type="text" value={topic} onChange={(e) => setTopic(e.target.value)}
                placeholder="Hong Kong cafe weekend offer" className={consoleInputClass} />
            </label>
            <label className="grid gap-1.5 text-sm font-medium text-zinc-700">
              <span>{t("extraPrompt")}</span>
              <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)}
                placeholder="Tone, platform, audience, or CTA..."
                className={`${consoleInputClass} min-h-24 resize-none`} />
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setIsAddOpen(false)}>{t("dlgCancel")}</Button>
              <Button onClick={handleGenerate} loading={loading}>
                <Bot size={16} />
                {t("btnAiGenerate")}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <label className="grid gap-1.5 text-sm font-medium text-zinc-700">
              <span>{t("articleUrl")}</span>
              <input type="text" value={url} onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com/blog-post" className={consoleInputClass} />
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setIsAddOpen(false)}>{t("dlgCancel")}</Button>
              <Button onClick={handleImportUrl} loading={loading}>
                <Globe2 size={16} />
                {t("btnExtractUrl")}
              </Button>
            </div>
          </div>
        )}
      </Dialog>

      <Dialog open={Boolean(selectedItem)} onClose={() => setSelectedItem(null)} title={selectedItem?.title || t("contentDetails")} maxWidth="lg">
        {selectedItem ? (
          <div className="max-h-[70vh] space-y-5 overflow-y-auto pr-2 text-sm">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-[28px] bg-zinc-50 p-4">
                <p className="text-xs font-semibold uppercase text-zinc-400">{t("contentProvider")}</p>
                <p className="mt-1 text-zinc-800">{metadataString(selectedItem.metadata, "provider") || t("contentNoValue")}</p>
              </div>
              <div className="rounded-[28px] bg-zinc-50 p-4">
                <p className="text-xs font-semibold uppercase text-zinc-400">{t("contentModel")}</p>
                <p className="mt-1 text-zinc-800">{metadataString(selectedItem.metadata, "model") || t("contentNoValue")}</p>
              </div>
            </div>

            {selectedImageUrl ? (
              <figure className="rounded-[28px] border border-zinc-100 bg-zinc-50 p-4">
                <figcaption className="mb-2 text-xs font-semibold uppercase text-zinc-400">{t("contentImage")}</figcaption>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={selectedImageUrl} alt={selectedItem.title} className="max-h-80 w-full rounded-[24px] object-contain" />
              </figure>
            ) : null}

            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase text-zinc-400">{t("contentFullPost")}</h3>
              <p className="whitespace-pre-wrap rounded-[28px] bg-zinc-50 p-4 leading-6 text-zinc-700">{selectedItem.postReadyText || t("contentNoValue")}</p>
            </section>
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase text-zinc-400">{t("contentBody")}</h3>
              <p className="whitespace-pre-wrap rounded-[28px] bg-zinc-50 p-4 leading-6 text-zinc-700">{selectedItem.body || t("contentNoValue")}</p>
            </section>
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase text-zinc-400">{t("contentImagePrompt")}</h3>
              <p className="whitespace-pre-wrap rounded-[28px] bg-zinc-50 p-4 leading-6 text-zinc-700">{metadataString(selectedItem.metadata, "imagePrompt") || t("contentNoValue")}</p>
            </section>
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase text-zinc-400">{t("contentSources")}</h3>
              <p className="break-words rounded-[28px] bg-zinc-50 p-4 leading-6 text-zinc-700">{selectedItem.sourceUrls.join("\n") || t("contentNoValue")}</p>
            </section>
            <p className="text-xs text-zinc-400">{t("contentCreatedAt")}: {new Date(selectedItem.createdAt).toLocaleString()}</p>
          </div>
        ) : null}
      </Dialog>
    </div>
  );
}
