import { z } from "zod";
import {
  createAgentChatThread,
  createAgentChatMessage,
  createAgentToolCall,
  createSchedule,
  createContentItem,
  getContentItem,
  getAgentChatThread,
  getSite,
  listSites,
  listAgentChatMessages,
  updateContentItemImage,
  updateAgentToolCall,
} from "@/db/repository";
import { defaultChatThreadTitle, updateChatThreadTitleIfNeeded, userMessagesForTitle } from "@/lib/agent/chat-thread-title";
import { buildAgentChatContext, buildCloudAgentChatContext, type AgentChatContext } from "@/lib/agent/chat-context";
import { getLocalAgentSettings } from "@/db/repositories/settings";
import { LangGraphAgentEngine } from "@/lib/agent/langgraph-engine";
import { generateImageFile } from "@/lib/agent/image-generation";
import { looksLikeScheduleRequest, resolveScheduleIntent } from "@/lib/agent/schedule-intent";
import { fail, ok, parseJson } from "@/lib/api";
import { runSiteBrowserTool, type SiteBrowserToolName } from "@/lib/browser-preview";
import { localeResources, normalizeLocale } from "@/lib/locale-resources";
import { callSMEPost, readSMEPostAuth } from "@/lib/smepost-auth";
import type { AgentCreditType, AgentToolStatus, SiteRecord } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const browserToolNames = [
  "browser_goto",
  "browser_snapshot",
  "browser_click",
  "browser_type",
  "browser_press",
  "browser_tab_control",
  "browser_screenshot",
  "threads_create_post",
] as const;

const schema = z.object({
  message: z.string().trim().min(1),
  threadId: z.string().trim().optional(),
  targetSiteId: z.string().trim().optional(),
  params: z.record(z.string(), z.unknown()).optional().default({}),
  locale: z.string().trim().optional(),
});

type IncomingToolCall = {
  id?: string;
  name: string;
  status?: AgentToolStatus | "queued";
  input?: Record<string, unknown>;
  args?: Record<string, unknown>;
  output?: Record<string, unknown>;
  commandId?: string;
  creditType?: AgentCreditType;
  creditCost?: number;
};

type CloudToolRequest = {
  name: "browser_goto" | "browser_snapshot" | "generate_image";
  input?: Record<string, unknown>;
};

type CloudBrowserCommand = {
  id: string;
  type: "browser_goto" | "browser_snapshot";
  payload?: Record<string, unknown>;
};

function isBrowserTool(name: string): name is SiteBrowserToolName {
  return browserToolNames.includes(name as SiteBrowserToolName);
}

function wantsCloudImage(message: string) {
  return /\b(image|picture|photo|generate.*visual|create.*visual|illustration|nano\s*banana|nanobanana|圖|圖片|相|插圖)\b/i.test(message);
}

function wantsCloudBrowser(message: string, site?: SiteRecord) {
  return Boolean(site) && (
    /\b(browser|profile|open|snapshot|visit|threads|post|draft|publish|navigate|control)\b/i.test(message) ||
    /瀏覽器|開啟|截圖|快照|發佈|發布|貼文|草稿|控制/.test(message)
  );
}

function buildCloudToolRequests(input: {
  message: string;
  site?: SiteRecord;
  chatContext?: AgentChatContext;
}): CloudToolRequest[] {
  const requests: CloudToolRequest[] = [];

  if (wantsCloudBrowser(input.message, input.site)) {
    requests.push({
      name: "browser_goto",
      input: { url: input.site?.url || "https://www.threads.net/" },
    });
    if (/\b(snapshot|screenshot|read|inspect|check)\b/i.test(input.message) || /截圖|快照|讀取|檢查/.test(input.message)) {
      requests.push({ name: "browser_snapshot", input: {} });
    }
  }

  if (wantsCloudImage(input.message)) {
    requests.push({
      name: "generate_image",
      input: {
        prompt: input.chatContext?.latestPostText
          ? `Create an image for this post: ${input.chatContext.latestPostText}`
          : `Create a social media image for this request: ${input.message}`,
      },
    });
  }

  return requests.slice(0, 5);
}

async function runBackendAgent(input: {
  message: string;
  locale: ReturnType<typeof normalizeLocale>;
  site?: SiteRecord;
  titleMessages?: string[];
  chatContext?: AgentChatContext;
}) {
  const auth = await readSMEPostAuth();
  if (!auth) return null;

  const result = await callSMEPost<{
    mode: "smepost";
    assistant: string;
    threadTitle?: string;
    toolCalls?: IncomingToolCall[];
    credits?: Record<string, unknown>;
  }>(auth, "/api/auto-post/agent/chat", {
    method: "POST",
    body: JSON.stringify({
      runnerId: auth.runnerId,
      message: input.message,
      locale: input.locale,
      titleMessages: input.titleMessages,
      chatContext: buildCloudAgentChatContext(input.chatContext),
      toolRequests: buildCloudToolRequests(input),
      site: input.site
        ? {
            id: input.site.id,
            name: input.site.name,
            platform: input.site.platform,
            url: input.site.url,
            account: input.site.account,
            status: input.site.status,
          }
        : undefined,
    }),
  });

  const item = await createContentItem({
    title: input.message.slice(0, 80),
    body: result.assistant,
    postReadyText: result.assistant,
    sourceUrls: [],
    metadata: {
      provider: "smepost",
      model: "smepost-cloud",
      generationType: "smepost_agent_chat",
    },
    status: "ready",
  });

  return {
    ...result,
    mode: "smepost" as const,
    item,
    toolCalls: (result.toolCalls ?? []).map((tool) =>
      tool.name === "generate_image"
        ? {
            ...tool,
            input: {
              ...(tool.input ?? {}),
              contentItemId: item.id,
              prompt: typeof tool.input?.prompt === "string" && tool.input.prompt.trim()
                ? tool.input.prompt
                : `Create an image for this post: ${result.assistant}`,
            },
          }
        : tool
    ),
  };
}

async function claimCloudBrowserCommand(commandId: string) {
  const auth = await readSMEPostAuth();
  if (!auth) throw new Error("SMEPost runner is not connected.");
  const result = await callSMEPost<{ commands?: CloudBrowserCommand[] }>(
    auth,
    `/api/auto-post/runners/${encodeURIComponent(auth.runnerId)}/commands?limit=10`,
  );
  const commands = Array.isArray(result.commands) ? result.commands : [];
  const command = commands.find((candidate) => candidate.id === commandId);
  if (!command) {
    throw new Error(`SMEPost browser command ${commandId} was not claimed.`);
  }
  return { auth, command };
}

async function completeCloudBrowserCommand(input: {
  runnerId: string;
  commandId: string;
  ok: boolean;
  result?: Record<string, unknown>;
  error?: string;
}) {
  const auth = await readSMEPostAuth();
  if (!auth) throw new Error("SMEPost runner is not connected.");
  return callSMEPost(auth, `/api/auto-post/runners/${encodeURIComponent(input.runnerId)}/commands/${encodeURIComponent(input.commandId)}/result`, {
    method: "POST",
    body: JSON.stringify({
      ok: input.ok,
      result: input.result,
      error: input.error,
    }),
  });
}

async function executeCloudToolCalls(input: {
  threadId: string;
  assistantMessageId: string;
  site?: SiteRecord;
  toolCalls: IncomingToolCall[];
}) {
  const executed = [];

  for (const tool of input.toolCalls) {
    const toolInput = tool.input ?? tool.args ?? {};
    const stored = await createAgentToolCall({
      threadId: input.threadId,
      messageId: input.assistantMessageId,
      name: tool.name,
      status: "running",
      siteId: input.site?.id,
      input: toolInput,
      output: tool.output ?? {},
      creditType: tool.creditType,
      creditCost: tool.creditCost,
    });

    if (tool.name === "generate_image") {
      try {
        const prompt = typeof toolInput.prompt === "string" && toolInput.prompt.trim()
          ? toolInput.prompt
          : "Create a social media image for this post.";
        const image = await generateImageFile({ prompt });
        const output = { ...tool.output, ...image, prompt };
        const itemId = typeof toolInput.contentItemId === "string" ? toolInput.contentItemId : undefined;
        if (itemId) {
          await updateContentItemImage({
            itemId,
            imagePath: image.path,
            imagePrompt: prompt,
            provider: image.provider,
            model: image.model,
          });
        }
        const completed = await updateAgentToolCall(stored.id, {
          status: "completed",
          output,
          creditType: tool.creditType,
          creditCost: tool.creditCost,
        });
        executed.push(completed ?? stored);
      } catch (error) {
        const failed = await updateAgentToolCall(stored.id, {
          status: "failed",
          output: { error: error instanceof Error ? error.message : String(error) },
          creditType: tool.creditType,
          creditCost: tool.creditCost,
        });
        executed.push(failed ?? stored);
      }
      continue;
    }

    if (!isBrowserTool(tool.name)) {
      const completed = await updateAgentToolCall(stored.id, {
        status: tool.status === "failed" ? "failed" : "completed",
        output: tool.output ?? {},
        creditType: tool.creditType,
        creditCost: tool.creditCost,
      });
      executed.push(completed ?? stored);
      continue;
    }

    if (!input.site) {
      const failed = await updateAgentToolCall(stored.id, {
        status: "failed",
        output: { error: "Mention a site with @ before using browser tools." },
        creditType: tool.creditType,
        creditCost: tool.creditCost,
      });
      executed.push(failed ?? stored);
      continue;
    }

    try {
      let commandInput = toolInput;
      const commandId = tool.commandId;
      let runnerId: string | undefined;
      if (commandId) {
        const claimed = await claimCloudBrowserCommand(commandId);
        runnerId = claimed.auth.runnerId;
        commandInput = claimed.command.payload ?? toolInput;
      }
      const output = await runSiteBrowserTool(input.site, { name: tool.name, args: commandInput });
      if (commandId && runnerId) {
        await completeCloudBrowserCommand({
          runnerId,
          commandId,
          ok: true,
          result: output,
        });
      }
      const completed = await updateAgentToolCall(stored.id, {
        status: "completed",
        output: { ...output, loginRequired: input.site.status === "needs_login" },
        creditType: tool.creditType,
        creditCost: tool.creditCost,
      });
      executed.push(completed ?? stored);
    } catch (error) {
      if (tool.commandId) {
        const auth = await readSMEPostAuth();
        if (auth) {
          await completeCloudBrowserCommand({
            runnerId: auth.runnerId,
            commandId: tool.commandId,
            ok: false,
            error: error instanceof Error ? error.message : String(error),
          }).catch(() => undefined);
        }
      }
      const failed = await updateAgentToolCall(stored.id, {
        status: "failed",
        output: { error: error instanceof Error ? error.message : String(error) },
        creditType: tool.creditType,
        creditCost: tool.creditCost,
      });
      executed.push(failed ?? stored);
    }
  }

  return executed;
}

async function persistLocalToolCalls(input: {
  threadId: string;
  assistantMessageId: string;
  site?: SiteRecord;
  toolCalls: Array<{
    name: string;
    input: Record<string, unknown>;
    output: Record<string, unknown>;
    status: "completed" | "failed" | "pending";
  }>;
}) {
  const stored = [];
  for (const tool of input.toolCalls) {
    stored.push(
      await createAgentToolCall({
        threadId: input.threadId,
        messageId: input.assistantMessageId,
        name: tool.name,
        status: tool.status === "pending" ? "pending" : tool.status,
        siteId: input.site?.id,
        input: tool.input,
        output: {
          ...tool.output,
          loginRequired: tool.name.startsWith("browser_") && input.site?.status === "needs_login",
        },
        creditType: tool.name.includes("image") ? "image" : undefined,
        creditCost: tool.name.includes("image") ? 0 : undefined,
      }),
    );
  }
  return stored;
}

export async function GET(request: Request) {
  try {
    const threadId = new URL(request.url).searchParams.get("threadId") || undefined;
    if (!threadId) return ok({ thread: null, messages: [] });
    const thread = await getAgentChatThread(threadId);
    if (!thread) return fail("Chat thread not found", 404);
    return ok({ thread, messages: await listAgentChatMessages(thread.id) });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Failed to load chat history", 500);
  }
}

export async function POST(request: Request) {
  const parsed = await parseJson(request, schema);
  if (parsed.error) return fail("Invalid agent chat payload", 400, parsed.error);

  try {
    const site = parsed.data.targetSiteId ? await getSite(parsed.data.targetSiteId) : undefined;
    if (parsed.data.targetSiteId && !site) return fail("Target site not found", 404);

    const settings = await getLocalAgentSettings();
    const locale = normalizeLocale(parsed.data.locale);
    const thread = parsed.data.threadId
      ? await getAgentChatThread(parsed.data.threadId, site?.id)
      : await createAgentChatThread({ activeSiteId: site?.id, title: defaultChatThreadTitle(locale) });
    if (!thread) return fail("Chat thread not found", 404);
    const userMessage = await createAgentChatMessage({
      threadId: thread.id,
      role: "user",
      content: parsed.data.message,
      siteId: site?.id,
      metadata: site ? { siteName: site.name, siteStatus: site.status } : {},
    });
    const messagesAfterUser = await listAgentChatMessages(thread.id);
    const titleMessages = userMessagesForTitle(messagesAfterUser);
    const chatContext = buildAgentChatContext(messagesAfterUser);

    if (looksLikeScheduleRequest(parsed.data.message)) {
      const scheduleText = localeResources[locale];
      let assistantText = scheduleText.schedulePostPrepared;
      try {
        if (!chatContext.latestContentItemId) throw new Error(scheduleText.schedulePostMissingContent);
        const content = await getContentItem(chatContext.latestContentItemId);
        if (!content) throw new Error(scheduleText.schedulePostMissingContent);
        const intent = resolveScheduleIntent({
          message: parsed.data.message,
          sites: await listSites(),
          selectedSite: site ?? undefined,
        });
        const toolInput = {
          scheduledAt: intent.scheduledAt,
          timeZone: intent.timeZone,
          siteId: intent.site.id,
          siteName: intent.site.name,
          contentItemId: content.id,
          postPreview: content.postReadyText || content.body,
        };
        const autoApprove = settings.agentPermissions.schedulePost === "auto";
        const schedule = autoApprove ? await createSchedule({
          playbookId: "threads_auto_post",
          siteId: intent.site.id,
          enabled: true,
          scheduleTimes: [{ type: "once", at: new Date(intent.scheduledAt).toISOString() }],
          params: { contentItemId: content.id, scheduledPublishAuthorized: true },
          nextRunAt: intent.scheduledAt,
          contentItemId: content.id,
          publishAuthorized: true,
        }) : null;
        if (autoApprove && !schedule) throw new Error(scheduleText.schedulePostCreateFailed);
        assistantText = autoApprove ? scheduleText.schedulePostCreated : scheduleText.schedulePostApprovalRequired;
        const assistant = await createAgentChatMessage({
          threadId: thread.id,
          role: "assistant",
          content: assistantText,
          siteId: intent.site.id,
          mode: settings.runtimeMode === "cloud" ? "smepost" : "local",
          metadata: { userMessageId: userMessage.id, scheduleRequest: true },
        });
        await createAgentToolCall({
          threadId: thread.id,
          messageId: assistant.id,
          name: "schedule_threads_post",
          status: autoApprove ? "completed" : "pending",
          siteId: intent.site.id,
          input: toolInput,
          output: schedule ? { scheduleId: schedule.id, status: schedule.status } : {},
        });
      } catch (error) {
        const rawMessage = error instanceof Error ? error.message : String(error);
        assistantText = /time such as/i.test(rawMessage) ? scheduleText.schedulePostInvalidTime
          : /supports one-time|future/i.test(rawMessage) ? scheduleText.schedulePostInvalidDate
          : /More than one/i.test(rawMessage) ? scheduleText.schedulePostAmbiguousAccount
          : /could not identify/i.test(rawMessage) ? scheduleText.schedulePostMissingAccount
          : /no browser profile/i.test(rawMessage) ? scheduleText.schedulePostMissingProfile
          : rawMessage;
        await createAgentChatMessage({
          threadId: thread.id,
          role: "assistant",
          content: assistantText,
          siteId: site?.id,
          mode: settings.runtimeMode === "cloud" ? "smepost" : "local",
          metadata: { userMessageId: userMessage.id, scheduleRequest: true, failed: true },
        });
      }
      return ok({
        mode: settings.runtimeMode === "cloud" ? "smepost" : "local",
        assistant: assistantText,
        thread,
        messages: await listAgentChatMessages(thread.id),
      });
    }

    const useCloud = settings.runtimeMode === "cloud";

    if (useCloud) {
      const backend = await runBackendAgent({
        message: parsed.data.message,
        locale,
        site: site ?? undefined,
        titleMessages,
        chatContext,
      });
      if (!backend) {
        return fail("SMEPost runner is not connected. Switch runtime mode to local or login to SMEPost.", 401);
      }
      const assistant = await createAgentChatMessage({
        threadId: thread.id,
        role: "assistant",
        content: backend.assistant,
        siteId: site?.id,
        mode: "smepost",
        metadata: { userMessageId: userMessage.id, itemId: backend.item?.id, targetSiteName: site?.name },
      });
      await executeCloudToolCalls({
        threadId: thread.id,
        assistantMessageId: assistant.id,
        site: site ?? undefined,
        toolCalls: backend.toolCalls ?? [],
      });
      const responseThread = await updateChatThreadTitleIfNeeded({
        thread,
        messages: messagesAfterUser,
        locale,
        jobDone: true,
        preferredTitle: backend.threadTitle,
      });
      return ok({
        mode: "smepost",
        assistant: backend.assistant,
        item: backend.item,
        thread: responseThread,
        messages: await listAgentChatMessages(thread.id),
      });
    }

    const engine = new LangGraphAgentEngine();
    const local = await engine.run({
      threadId: thread.id,
      site: site ?? undefined,
      message: parsed.data.message,
      params: parsed.data.params,
      locale,
      chatContext,
    });
    const assistant = await createAgentChatMessage({
      threadId: thread.id,
      role: "assistant",
      content: local.assistant,
      siteId: site?.id,
      mode: "local",
      metadata: {
        userMessageId: userMessage.id,
        targetSiteName: site?.name,
        localAgentRunId: local.run.id,
        localAgentStatus: local.status,
      },
    });
    await persistLocalToolCalls({
      threadId: thread.id,
      assistantMessageId: assistant.id,
      site: site ?? undefined,
      toolCalls: local.toolCalls,
    });
    const responseThread = await updateChatThreadTitleIfNeeded({
      thread,
      messages: messagesAfterUser,
      locale,
      jobDone: local.status !== "queued" && local.status !== "running" && local.status !== "paused",
    });
    return ok({
      mode: "local",
      assistant: local.assistant,
      thread: responseThread,
      agentRunId: local.run.id,
      status: local.status,
      messages: await listAgentChatMessages(thread.id),
    });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Agent chat failed", 500);
  }
}
