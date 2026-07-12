"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MessageCircle, Plus } from "lucide-react";
import useSWR from "swr";
import type { AgentChatThreadRecord, SiteRecord } from "@/lib/types";
import { useI18n } from "@/lib/i18n";
import { swrFetcher } from "@/lib/api-client";
import { localizedPath } from "@/lib/i18n-config";
import { Button } from "@/components/ui/button";
import { useConsoleHeaderActions } from "@/components/ui/console-header-actions";
import { ConsolePagination, useClampConsolePage, usePagedItems } from "@/components/ui/console-pagination";

const ACTIVE_THREAD_STORAGE_KEY = "agent-chat-active-thread-id";

export default function ChatroomPage() {
  const router = useRouter();
  const { t, locale } = useI18n();
  const { data: threads = [] } = useSWR<AgentChatThreadRecord[]>("/api/agent/chat/threads?limit=200", swrFetcher);
  const { data: sites = [] } = useSWR<SiteRecord[]>("/api/sites", swrFetcher);
  const [page, setPage] = useState(1);
  const siteById = new Map(sites.map((site) => [site.id, site]));
  const { pageItems: visibleThreads, safePage } = usePagedItems(threads, page);
  useClampConsolePage(page, threads.length, setPage);

  const createNewChat = useCallback(() => {
    window.localStorage.removeItem(ACTIVE_THREAD_STORAGE_KEY);
    router.push(localizedPath(locale, `/sites/list?newChat=${Date.now()}`));
  }, [locale, router]);

  const headerActions = useMemo(() => (
    <Button onClick={createNewChat}>
      <Plus className="size-4" />
      {t("agentNewChat")}
    </Button>
  ), [createNewChat, t]);
  useConsoleHeaderActions(headerActions);

  function threadHref(thread: AgentChatThreadRecord) {
    const params = new URLSearchParams({ threadId: thread.id });
    if (thread.activeSiteId) {
      params.set("siteId", thread.activeSiteId);
      params.set("browserTab", thread.activeSiteId);
    }
    return localizedPath(locale, `/sites/list?${params.toString()}`);
  }

  return (
    <div className="space-y-6">
      <section className="space-y-4">
      <div className="grid gap-2">
        {threads.length === 0 ? (
          <div className="border-y border-dashed border-border py-6 text-center text-sm text-muted-foreground">
            {t("agentEmptyHistory")}
          </div>
        ) : (
          visibleThreads.map((thread) => {
            const site = thread.activeSiteId ? siteById.get(thread.activeSiteId) : undefined;
            return (
              <Link
                key={thread.id}
                href={threadHref(thread)}
                onClick={() => window.localStorage.setItem(ACTIVE_THREAD_STORAGE_KEY, thread.id)}
                className="flex items-center gap-3 border-b border-border py-3 text-left transition hover:bg-sky-50"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-2xl bg-sky-50 text-sky-700">
                  <MessageCircle className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-foreground">{thread.title || t("agentThreadUntitled")}</span>
                  <span className="mt-1 block truncate text-xs text-muted-foreground">
                    {site?.name || "-"} - {new Date(thread.updatedAt).toLocaleString()}
                  </span>
                </span>
              </Link>
            );
          })
        )}
      </div>
      <ConsolePagination page={safePage} totalItems={threads.length} onPageChange={setPage} />
      </section>
    </div>
  );
}
