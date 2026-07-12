"use client";

import * as React from "react";
import useSWR from "swr";
import { Loader2, Plus } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useSWRConfig } from "swr";
import { ChatInput } from "./chat-input";
import { IconButton } from "@/components/ui/form-controls";
import {
  AssistantMessageCard,
  ScheduledPostMessageCard,
  SystemMessageCard,
  ToolCallMessageCard,
  UserMessageCard,
} from "./message-cards";
import type { AgentChatMessageWithTools, AgentChatThreadRecord, ScheduleRecord, SiteRecord } from "@/lib/types";
import { useI18n } from "@/lib/i18n";
import { apiDelete, apiGet, apiPost, swrFetcher } from "@/lib/api-client";
import { localizedPath } from "@/lib/i18n-config";
import type { AgentRuntimeMode, LocalAgentSettings } from "@/lib/types";

type ChatHistoryResponse = {
  thread: AgentChatThreadRecord | null;
  messages: AgentChatMessageWithTools[];
};

type SettingsResponse = LocalAgentSettings & {
  geminiKey: string;
  groqKey: string;
  openAIKey: string;
  openRouterKey: string;
};

type AccountState = {
  connected: boolean;
  error?: string;
};

const ACTIVE_THREAD_STORAGE_KEY = "agent-chat-active-thread-id";

type AgentChatPanelProps = {
  sites: SiteRecord[];
  activeSiteId: string;
  initialThreadId?: string;
  draftToken?: string;
  onTargetSiteSelected: (site: SiteRecord) => void | Promise<void>;
};

export function AgentChatPanel({
  sites,
  activeSiteId,
  initialThreadId = "",
  draftToken = "",
  onTargetSiteSelected,
}: AgentChatPanelProps) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const pathname = usePathname() || "";
  const searchParams = useSearchParams();
  const { mutate: mutateCache } = useSWRConfig();
  const [input, setInput] = React.useState("");
  const [selectedSiteId, setSelectedSiteId] = React.useState(activeSiteId);
  const [submitting, setSubmitting] = React.useState(false);
  const [resumingRunId, setResumingRunId] = React.useState("");
  const [pendingUserMessage, setPendingUserMessage] = React.useState<AgentChatMessageWithTools | null>(null);
  const [threadId, setThreadId] = React.useState(() => {
    if (initialThreadId) return initialThreadId;
    if (draftToken || typeof window === "undefined") return "";
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem(ACTIVE_THREAD_STORAGE_KEY) || "";
  });
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const { data: settings, mutate: reloadSettings } = useSWR<SettingsResponse>("/api/settings/ai", swrFetcher, { refreshInterval: 5000 });
  const { data: account } = useSWR<AccountState>("/api/smepost/account", swrFetcher, { refreshInterval: 40_000 });
  const chatUrl = threadId ? `/api/agent/chat?threadId=${encodeURIComponent(threadId)}` : null;
  const { data, mutate, isLoading } = useSWR<ChatHistoryResponse>(chatUrl, swrFetcher);
  const { data: schedules = [], mutate: mutateSchedules } = useSWR<ScheduleRecord[]>("/api/schedules", swrFetcher, { refreshInterval: 5000 });
  const scheduleById = React.useMemo(() => new Map(schedules.map((schedule) => [schedule.id, schedule])), [schedules]);

  React.useEffect(() => {
    if (activeSiteId && activeSiteId !== selectedSiteId) {
      window.queueMicrotask(() => setSelectedSiteId(activeSiteId));
    }
  }, [activeSiteId, selectedSiteId]);

  React.useEffect(() => {
    if (!initialThreadId || initialThreadId === threadId) return;
    window.queueMicrotask(() => {
      setThreadId(initialThreadId);
      window.localStorage.setItem(ACTIVE_THREAD_STORAGE_KEY, initialThreadId);
      setPendingUserMessage(null);
    });
  }, [initialThreadId, threadId]);

  React.useEffect(() => {
    if (!draftToken) return;
    window.queueMicrotask(() => {
      setThreadId("");
      setInput("");
      setPendingUserMessage(null);
      window.localStorage.removeItem(ACTIVE_THREAD_STORAGE_KEY);
      void mutate({ thread: null, messages: [] }, false);
    });
  }, [draftToken, mutate]);

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [data?.messages.length, pendingUserMessage, submitting]);

  const siteById = React.useMemo(() => new Map(sites.map((site) => [site.id, site])), [sites]);
  const selectedSite = selectedSiteId ? siteById.get(selectedSiteId) : undefined;
  const messages = data?.messages ?? [];
  const runtimeMode = settings?.runtimeMode ?? "local";
  const cloudUnavailable = account?.connected === false;

  const syncThreadParams = React.useCallback((nextThreadId?: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (nextThreadId) {
      params.set("threadId", nextThreadId);
    } else {
      params.delete("threadId");
    }
    params.delete("newChat");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  const startDraftChat = React.useCallback(() => {
    if (submitting) return;
    setThreadId("");
    setInput("");
    setPendingUserMessage(null);
    window.localStorage.removeItem(ACTIVE_THREAD_STORAGE_KEY);
    void mutate({ thread: null, messages: [] }, false);
    syncThreadParams();
  }, [mutate, submitting, syncThreadParams]);

  const changeRuntimeMode = async (mode: AgentRuntimeMode) => {
    if (mode === "cloud") {
      const nextAccount = await apiGet<AccountState>("/api/smepost/account");
      if (!nextAccount.connected) {
        router.push(localizedPath(locale, "/account/smepost"));
        return;
      }
    }
    await apiPost("/api/settings/ai", { runtimeMode: mode });
    await reloadSettings();
  };

  const sendMessage = async () => {
    const message = input.trim();
    if (!message || submitting) return;
    const currentThreadId = data?.thread?.id ?? threadId;

    setInput("");
    setSubmitting(true);
    setPendingUserMessage({
      id: `pending-${Date.now()}`,
      threadId: currentThreadId || "draft-agent-thread",
      role: "user",
      content: message,
      siteId: selectedSite?.id,
      metadata: {},
      createdAt: Date.now(),
      toolCalls: [],
    });

    try {
      if (selectedSite) {
        await onTargetSiteSelected(selectedSite);
      }
      const result = await apiPost<ChatHistoryResponse & { mode: "local" | "smepost" }>("/api/agent/chat", {
        message,
        threadId: currentThreadId || undefined,
        targetSiteId: selectedSite?.id,
        locale,
      });
      if (result.thread) {
        setThreadId(result.thread.id);
        window.localStorage.setItem(ACTIVE_THREAD_STORAGE_KEY, result.thread.id);
        syncThreadParams(result.thread.id);
      }
      setPendingUserMessage(null);
      await mutate({ thread: result.thread, messages: result.messages }, false);
      await mutateCache((key) => typeof key === "string" && key.startsWith("/api/agent/chat/threads"));
    } finally {
      setSubmitting(false);
      setPendingUserMessage(null);
    }
  };

  const resumeRun = async (agentRunId: string, approved: boolean) => {
    if (!agentRunId || resumingRunId) return;
    setResumingRunId(agentRunId);
    try {
      await apiPost(`/api/agent/runs/${encodeURIComponent(agentRunId)}/resume`, { approved, input: { locale } });
      await mutate();
      await mutateCache((key) => typeof key === "string" && key.startsWith("/api/agent/chat/threads"));
    } finally {
      setResumingRunId("");
    }
  };

  const approveSchedule = async (toolCallId: string, approved: boolean) => {
    if (resumingRunId) return;
    setResumingRunId(toolCallId);
    try {
      await apiPost("/api/agent/schedules", { toolCallId, approved });
      await Promise.all([mutate(), mutateSchedules()]);
    } finally {
      setResumingRunId("");
    }
  };

  const cancelSchedule = async (scheduleId: string) => {
    if (!scheduleId || resumingRunId) return;
    setResumingRunId(scheduleId);
    try {
      await apiDelete(`/api/agent/schedules/${encodeURIComponent(scheduleId)}`);
      await mutateSchedules();
    } finally {
      setResumingRunId("");
    }
  };

  const renderedMessages = pendingUserMessage ? [...messages, pendingUserMessage] : messages;

  return (
    <section className="flex h-full min-w-0 flex-col bg-card">
      <header className="border-b border-border px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="truncate text-base font-semibold text-foreground">{t("agentChatShortTitle")}</h2>
          <IconButton label={t("agentNewChat")} onClick={startDraftChat}>
            <Plus className="h-4 w-4" />
          </IconButton>
        </div>
      </header>

      <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-slate-50/60 px-4 py-4">
        {isLoading ? (
          <div className="flex items-center gap-2 rounded-xl border border-dashed border-border bg-card px-4 py-3 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t("agentLoadingHistory")}
          </div>
        ) : null}

        {!isLoading && renderedMessages.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
            {t("agentEmptyState")}
          </div>
        ) : null}

        {renderedMessages.map((message) => {
          const site = message.siteId ? siteById.get(message.siteId) : undefined;
          if (message.role === "user") {
            return <UserMessageCard key={message.id} message={message} site={site} />;
          }
          if (message.role === "system") {
            return <SystemMessageCard key={message.id} message={message} title={t("agentSystemLabel")} />;
          }
          if (message.role === "assistant") {
            const localAgentRunId = typeof message.metadata.localAgentRunId === "string" ? message.metadata.localAgentRunId : "";
            const isPausedLocalRun = message.metadata.localAgentStatus === "paused" && Boolean(localAgentRunId);
            return (
              <div key={message.id} className="space-y-2">
                <AssistantMessageCard
                  message={message}
                  modeLabel={message.mode === "smepost" ? t("agentSMEPostMode") : t("agentLocalMode")}
                  assistantTitle={t("agentAssistantName")}
                  site={site}
                />
                {message.toolCalls.map((tool) => (
                  tool.name === "schedule_threads_post" ? (
                    <ScheduledPostMessageCard
                      key={tool.id}
                      tool={tool}
                      schedule={typeof tool.output.scheduleId === "string" ? scheduleById.get(tool.output.scheduleId) : undefined}
                      locale={locale}
                      busy={resumingRunId === tool.id || resumingRunId === tool.output.scheduleId}
                      labels={{ title: t("scheduledPostCardTitle"), approve: t("agentApproveTool"), reject: t("agentRejectTool"), cancel: t("dlgCancel"), pending: t("agentApprovingTool"), account: t("scheduledPostAccount"), time: t("scheduledPostTime"), timezone: t("scheduledPostTimezone"), post: t("scheduledPostPreview") }}
                      onApprove={() => void approveSchedule(tool.id, true)}
                      onReject={() => void approveSchedule(tool.id, false)}
                      onCancel={() => void cancelSchedule(String(tool.output.scheduleId ?? ""))}
                    />
                  ) : (
                  <ToolCallMessageCard
                    key={tool.id}
                    tool={tool}
                    site={tool.siteId ? siteById.get(tool.siteId) : site}
                    labels={{
                      input: t("agentToolInput"),
                      output: t("agentToolOutput"),
                      running: t("agentToolRunning"),
                      completed: t("agentToolCompleted"),
                      failed: t("agentToolFailed"),
                      details: t("agentToolCalls"),
                      collapse: t("dlgClose"),
                      loginRequired: t("agentLoginRequired"),
                      empty: t("agentToolEmpty"),
                      imagePreview: t("agentToolImagePreview"),
                      approve: t("agentApproveTool"),
                      reject: t("agentRejectTool"),
                      approving: t("agentApprovingTool"),
                      toolNames: {
                        browser_open_page: t("agentToolName_browser_open_page"),
                        browser_click: t("agentToolName_browser_click"),
                        browser_type: t("agentToolName_browser_type"),
                        browser_screenshot: t("agentToolName_browser_screenshot"),
                        generate_social_post_draft: t("agentToolName_generate_social_post_draft"),
                        generate_image_prompt: t("agentToolName_generate_image_prompt"),
                        generate_image_file: t("agentToolName_generate_image_file"),
                        threads_create_post: t("agentToolName_threads_create_post"),
                      },
                      fieldLabels: {
                        url: t("agentToolField_url"),
                        title: t("agentToolField_title"),
                        text: t("agentToolField_text"),
                        selector: t("agentToolField_selector"),
                        intent: t("agentToolField_intent"),
                        isFinalPublish: t("agentToolField_isFinalPublish"),
                        clicked: t("agentToolField_clicked"),
                        clear: t("agentToolField_clear"),
                        typed: t("agentToolField_typed"),
                        fullPage: t("agentToolField_fullPage"),
                        path: t("agentToolField_path"),
                        topic: t("agentToolField_topic"),
                        prompt: t("agentToolField_prompt"),
                        language: t("agentToolField_language"),
                        maxWords: t("agentToolField_maxWords"),
                        style: t("agentToolField_style"),
                        provider: t("agentToolField_provider"),
                        model: t("agentToolField_model"),
                        body: t("agentToolField_body"),
                        postReadyText: t("agentToolField_postReadyText"),
                        itemId: t("agentToolField_itemId"),
                        imagePath: t("agentToolField_imagePath"),
                        publish: t("agentToolField_publish"),
                        drafted: t("agentToolField_drafted"),
                        published: t("agentToolField_published"),
                        error: t("agentToolField_error"),
                        loginRequired: t("agentToolField_loginRequired"),
                        creditType: t("agentToolField_creditType"),
                        creditCost: t("agentToolField_creditCost"),
                      },
                      valueYes: t("agentValueYes"),
                      valueNo: t("agentValueNo"),
                      valueNone: t("agentValueNone"),
                    }}
                    approval={isPausedLocalRun && tool.status === "pending" ? {
                      disabled: resumingRunId === localAgentRunId,
                      onApprove: () => void resumeRun(localAgentRunId, true),
                      onReject: () => void resumeRun(localAgentRunId, false),
                    } : undefined}
                  />
                  )
                ))}
              </div>
            );
          }

          return null;
        })}

        {submitting ? (
          <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t("agentToolRunning")}
          </div>
        ) : null}
      </div>

      <div className="border-t border-border bg-card p-3">
        {selectedSite?.status === "needs_login" ? (
          <div className="mb-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            {t("agentLoginRequired")}
          </div>
        ) : null}
        <ChatInput
          value={input}
          selectedSiteId={selectedSiteId}
          sites={sites}
          disabled={submitting}
          placeholder={t("agentChatPlaceholder")}
          sendLabel={t("agentSend")}
          emptyMentionLabel={t("agentMentionEmpty")}
          targetSiteLabel={t("agentTargetSite")}
          runtimeMode={runtimeMode}
          runtimeLocalLabel={t("agentRuntimeBadgeLocal")}
          runtimeCloudLabel={t("agentRuntimeBadgeCloud")}
          runtimeCloudLoginLabel={t("agentRuntimeBadgeCloudLogin")}
          cloudLoginRequiredLabel={t("agentCloudLoginRequired")}
          cloudUnavailable={cloudUnavailable}
          onChange={setInput}
          onSelectSite={(site) => {
            setSelectedSiteId(site.id);
            void onTargetSiteSelected(site);
          }}
          onRuntimeModeChange={(mode) => void changeRuntimeMode(mode)}
          onSubmit={() => void sendMessage()}
        />
      </div>
    </section>
  );
}
