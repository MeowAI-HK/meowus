import path from "node:path";
import { z } from "zod";
import { nanoid } from "nanoid";
import { generateStructured, toolPlanSchema, type ToolPlanStep } from "@/lib/ai";
import {
  appendAgentRuntimeEvent,
  createAgentRuntimeRun,
  getAgentRuntimeRun,
  getSite,
  listAgentRuntimeEvents,
  updateAgentRuntimeRun,
} from "@/db/repository";
import { getBrandSettings, getLocalAgentSettings, getPromptSettings } from "@/db/repositories/settings";
import { defaultLocale, type Locale } from "@/lib/i18n-config";
import { localeResources, type TranslationKey } from "@/lib/locale-resources";
import { browserProfilesRoot } from "@/lib/paths";
import type { AgentRuntimeEventRecord } from "@/lib/types";
import { formatAgentChatContext } from "./chat-context";
import type { AgentEngine, AgentRunInput, AgentRunResult, AgentExecutionContext, PlannedToolCall } from "./contracts";
import { createDefaultToolRegistry } from "./local-tools";
import { ToolRegistry } from "./tool-registry";
import { buildLocalAgentSystemPrompt } from "./system-prompt";

type LocalGraphState = {
  message: string;
  toolCalls: PlannedToolCall[];
  toolResults: AgentRunResult["toolCalls"];
  assistant: string;
  pendingIndex?: number;
  pendingToolCall?: PlannedToolCall;
};

function localizeAgentText(locale: Locale | undefined, key: TranslationKey) {
  const dictionary = locale ? localeResources[locale] : localeResources[defaultLocale];
  return dictionary[key];
}

function wantsFetchPageData(message: string) {
  return /\b(fetch|read|scrape|extract|open|visit|summari[sz]e|data|website|網頁|網站|擷取|讀取|摘要)\b/i.test(message)
    || /https?:\/\//i.test(message);
}

function contextualPostPrompt(input: AgentRunInput) {
  const context = formatAgentChatContext(input.chatContext);
  return [
    context ? "Use this prior chat context. Do not include tool JSON or internal tool details." : "",
    context,
  ].filter(Boolean).join("\n");
}

function contextualImageTopic(input: AgentRunInput) {
  const latestPost = input.chatContext?.latestPostText;
  const context = formatAgentChatContext(input.chatContext);
  return [
    `Current image request: ${input.message}`,
    latestPost ? `Create the image for this post:\n${latestPost}` : "",
    !latestPost && context ? `Relevant prior chat context:\n${context}` : "",
  ].filter(Boolean).join("\n\n");
}

const PLANNER_SYSTEM_PROMPT = [
  "You are the planner for Meowus's local social media agent.",
  "Decide the minimal ordered list of tool calls needed to satisfy the user request.",
  "Only use tools from the provided catalog. Return an empty step list when no tool is needed.",
].join("\n");

function plannerGuidance(input: AgentRunInput) {
  const hasPriorPost = Boolean(input.chatContext?.latestPostText);
  const hasPriorImage = Boolean(input.chatContext?.latestImagePath);
  const isThreadsSite = Boolean(input.site?.platform.toLowerCase().includes("threads"));
  return [
    "Planning rules:",
    "- To write new post copy, include generate_social_post_draft.",
    "- To create an image, include generate_image_prompt then generate_image_file, in that order.",
    isThreadsSite
      ? "- To draft or publish on Threads, include threads_create_post. Set its input.publish to true ONLY when the user clearly asks to publish/send/發佈; otherwise use false (draft)."
      : "- No Threads site is selected, so do not include threads_create_post.",
    "- To open or read a web page, include browser_open_page with the page url in its input.",
    hasPriorPost
      ? "- A post draft already exists in the chat context; do not draft a new post unless the user asks for new copy."
      : "",
    hasPriorImage ? "- An image already exists in the chat context." : "",
  ].filter(Boolean).join("\n");
}

function toolCatalog(registry: ToolRegistry) {
  return registry.list().map((tool) => ({
    name: tool.name,
    description: tool.description,
    input: z.toJSONSchema(tool.inputSchema),
  }));
}

function buildPlannedCall(step: ToolPlanStep, input: AgentRunInput, present: Set<string>): PlannedToolCall {
  const stepInput = step.input ?? {};
  const explicitPublish = typeof input.params?.publish === "boolean" ? input.params.publish : undefined;

  switch (step.tool) {
    case "generate_social_post_draft":
      return {
        id: nanoid(),
        name: step.tool,
        input: {
          topic: typeof stepInput.topic === "string" && stepInput.topic.trim() ? stepInput.topic : input.message,
          prompt: [input.params?.prompt, contextualPostPrompt(input)].filter(Boolean).join("\n\n"),
          language: input.params?.language ?? "Traditional Chinese",
          maxWords: input.params?.maxWords ?? 260,
        },
      };
    case "generate_image_prompt":
      return {
        id: nanoid(),
        name: step.tool,
        input: {
          topic: contextualImageTopic(input),
          postContext: input.chatContext?.latestPostText ?? "",
        },
      };
    case "generate_image_file":
      return {
        id: nanoid(),
        name: step.tool,
        input: {
          prompt: "",
          promptFromImagePrompt: present.has("generate_image_prompt"),
          contentItemId: input.chatContext?.latestContentItemId ?? "",
        },
      };
    case "threads_create_post": {
      const hasDraft = present.has("generate_social_post_draft");
      const hasImageFile = present.has("generate_image_file");
      return {
        id: nanoid(),
        name: step.tool,
        input: {
          text: "",
          imagePath: "",
          publish: explicitPublish ?? Boolean(stepInput.publish),
          textFromDraft: hasDraft,
          textFromContext: !hasDraft && Boolean(input.chatContext?.latestPostText),
          imageFromPrevious: hasImageFile,
          imageFromContext: !hasImageFile && Boolean(input.chatContext?.latestImagePath),
        },
      };
    }
    default:
      return { id: nanoid(), name: step.tool, input: { ...stepInput } };
  }
}

export async function planToolCalls(input: AgentRunInput, registry: ToolRegistry): Promise<PlannedToolCall[]> {
  const catalog = toolCatalog(registry);
  const context = formatAgentChatContext(input.chatContext);
  const prompt = [
    `User request: ${input.message}`,
    input.site ? `Selected site: ${input.site.name} (${input.site.platform})` : "No site is selected.",
    context ? `Prior chat context:\n${context}` : "",
    `Available tools: ${JSON.stringify(catalog)}`,
    plannerGuidance(input),
  ].filter(Boolean).join("\n\n");

  let steps: ToolPlanStep[];
  try {
    const result = await generateStructured({ prompt, systemPrompt: PLANNER_SYSTEM_PROMPT, schema: toolPlanSchema });
    steps = result.data.steps.filter((step) => registry.has(step.tool));
  } catch {
    steps = [];
  }

  if (steps.length === 0) {
    steps = [{ tool: "generate_social_post_draft", input: {} }];
  }

  const present = new Set(steps.map((step) => step.tool));
  return steps.map((step) => buildPlannedCall(step, input, present));
}

export class LangGraphAgentEngine implements AgentEngine {
  constructor(private readonly registry: ToolRegistry = createDefaultToolRegistry()) {}

  private resolveToolInput(call: PlannedToolCall, toolResults: AgentRunResult["toolCalls"], agentInput: AgentRunInput) {
    const resolvedInput = { ...call.input };
    if (call.name === "threads_create_post") {
      const draft = toolResults.find((result) => result.name === "generate_social_post_draft" && result.status === "completed");
      const image = toolResults.find((result) => result.name === "generate_image_file" && result.status === "completed");
      if (resolvedInput.textFromDraft && typeof draft?.output.postReadyText === "string") {
        resolvedInput.text = draft.output.postReadyText;
      }
      if (resolvedInput.textFromContext && typeof agentInput.chatContext?.latestPostText === "string") {
        resolvedInput.text = agentInput.chatContext.latestPostText;
      }
      if (resolvedInput.imageFromPrevious && typeof image?.output.path === "string") {
        resolvedInput.imagePath = image.output.path;
      }
      if (!resolvedInput.imagePath && resolvedInput.imageFromContext && typeof agentInput.chatContext?.latestImagePath === "string") {
        resolvedInput.imagePath = agentInput.chatContext.latestImagePath;
      }
      delete resolvedInput.textFromDraft;
      delete resolvedInput.imageFromPrevious;
      delete resolvedInput.textFromContext;
      delete resolvedInput.imageFromContext;
    }
    if (call.name === "generate_image_file" && resolvedInput.promptFromImagePrompt) {
      const imagePrompt = toolResults.find((result) => result.name === "generate_image_prompt" && result.status === "completed");
      const draft = toolResults.find((result) => result.name === "generate_social_post_draft" && result.status === "completed");
      if (typeof imagePrompt?.output.prompt === "string") {
        resolvedInput.prompt = imagePrompt.output.prompt;
        resolvedInput.imagePrompt = imagePrompt.output.prompt;
      }
      if (!resolvedInput.contentItemId && typeof draft?.output.itemId === "string") {
        resolvedInput.contentItemId = draft.output.itemId;
      }
      delete resolvedInput.promptFromImagePrompt;
    }
    return resolvedInput;
  }

  private buildAssistant(input: AgentRunInput, toolResults: AgentRunResult["toolCalls"]) {
    const locale = input.locale;
    const draft = toolResults.find((result) => result.name === "generate_social_post_draft" && result.status === "completed");
    const imagePrompt = toolResults.find((result) => result.name === "generate_image_prompt" && result.status === "completed");
    const imageFile = toolResults.find((result) => result.name === "generate_image_file" && result.status === "completed");
    const browser = toolResults.find((result) => result.name === "browser_open_page" && result.status === "completed");
    const threadsPost = toolResults.find((result) => result.name === "threads_create_post" && result.status === "completed");
    const postText = typeof draft?.output.postReadyText === "string"
      ? draft.output.postReadyText
      : input.chatContext?.latestPostText;
    const imagePath = typeof imageFile?.output.path === "string"
      ? imageFile.output.path
      : input.chatContext?.latestImagePath;
    const pageSummary = browser && wantsFetchPageData(input.message)
      ? [
          `\n\nBrowser result: ${typeof browser.output.title === "string" ? browser.output.title : ""}`,
          typeof browser.output.url === "string" ? `\n${browser.output.url}` : "",
          typeof browser.output.text === "string" ? `\n\n${browser.output.text.slice(0, 1200)}` : "",
        ].join("")
      : "";
    const postStatus = threadsPost
      ? `\n\nThreads: ${threadsPost.output.published ? "published" : threadsPost.output.drafted ? "drafted" : "not posted"}`
      : "";
    return [
      postText ?? localizeAgentText(locale, "agentLocalRunCompleted"),
      typeof imagePrompt?.output.prompt === "string" ? `\n\nImage prompt:\n${imagePrompt.output.prompt}` : "",
      imagePath ? `\n\nImage file:\n${imagePath}` : "",
      postStatus,
      pageSummary,
    ].join("");
  }

  private async executeToolCalls(input: {
    run: Awaited<ReturnType<typeof createAgentRuntimeRun>>;
    agentInput: AgentRunInput;
    context: AgentExecutionContext;
    toolCalls: PlannedToolCall[];
    initialResults?: AgentRunResult["toolCalls"];
    startIndex?: number;
    approvedToolCallId?: string;
  }) {
    const toolResults = [...(input.initialResults ?? [])];

    for (let index = input.startIndex ?? 0; index < input.toolCalls.length; index += 1) {
      const call = input.toolCalls[index];
      const resolvedInput = this.resolveToolInput(call, toolResults, input.agentInput);
      const isApprovedCall = input.approvedToolCallId === call.id;
      const toolContext = isApprovedCall
        ? { ...input.context, approvedToolCallId: call.id }
        : input.context;

      if (this.registry.requiresApproval(call.name, resolvedInput, toolContext)) {
        const pendingToolCall = { ...call, input: resolvedInput };
        await input.context.emit({
          type: "approval_required",
          message: `${localizeAgentText(input.agentInput.locale, "agentApprovalRequiredBefore")} ${call.name}`,
          data: { toolCall: pendingToolCall },
        });
        const state: LocalGraphState = {
          message: input.agentInput.message,
          toolCalls: input.toolCalls,
          toolResults,
          assistant: "",
          pendingIndex: index,
          pendingToolCall,
        };
        const updated = await updateAgentRuntimeRun(input.run.id, {
          status: "paused",
          state,
          pendingApproval: { toolCall: pendingToolCall },
        });
        return {
          run: updated ?? input.run,
          status: "paused" as const,
          assistant: localizeAgentText(input.agentInput.locale, "agentApprovalRequiredContinue"),
          toolCalls: [
            ...toolResults.slice(input.initialResults?.length ?? 0),
            { ...pendingToolCall, output: {}, status: "pending" as const },
          ],
        };
      }

      await input.context.emit({ type: "tool_start", message: call.name, data: { input: resolvedInput } });
      try {
        const output = await this.registry.execute(call.name, resolvedInput, toolContext);
        toolResults.push({ id: call.id, name: call.name, input: resolvedInput, output, status: "completed" });
        await input.context.emit({ type: "tool_end", message: call.name, data: { output } });
      } catch (error) {
        const output = { error: error instanceof Error ? error.message : String(error) };
        toolResults.push({ id: call.id, name: call.name, input: resolvedInput, output, status: "failed" });
        await input.context.emit({ type: "error", message: output.error, data: { tool: call.name } });
      }
    }

    const assistant = this.buildAssistant(input.agentInput, toolResults);
    await input.context.emit({ type: "final", message: assistant });
    const state: LocalGraphState = {
      message: input.agentInput.message,
      toolCalls: input.toolCalls,
      toolResults,
      assistant,
    };
    const updated = await updateAgentRuntimeRun(input.run.id, {
      status: "success",
      state,
      pendingApproval: {},
      result: { assistant, toolCalls: toolResults },
    });
    return {
      run: updated ?? input.run,
      status: "success" as const,
      assistant,
      toolCalls: toolResults.slice(input.initialResults?.length ?? 0),
    };
  }

  async run(input: AgentRunInput): Promise<AgentRunResult> {
    const [settings, brand, promptSettings] = await Promise.all([
      getLocalAgentSettings(),
      getBrandSettings(),
      getPromptSettings(),
    ]);
    const systemPrompt = buildLocalAgentSystemPrompt({
      customPrompt: promptSettings.systemPrompt,
      brand,
    });
    const run = await createAgentRuntimeRun({
      threadId: input.threadId,
      siteId: input.site?.id,
      mode: "local",
      status: "running",
      input: {
        message: input.message,
        params: input.params ?? {},
        locale: input.locale ?? defaultLocale,
        chatContext: input.chatContext ?? {},
      },
    });
    const context: AgentExecutionContext = {
      agentRunId: run.id,
      threadId: input.threadId,
      site: input.site,
      profilePath: input.site?.profilePath ?? path.join(browserProfilesRoot(), "default"),
      settings: { runtimeMode: settings.runtimeMode, agentPermissions: settings.agentPermissions },
      systemPrompt,
      emit: (event) => appendAgentRuntimeEvent({ agentRunId: run.id, ...event }).then(() => undefined),
    };

    await context.emit({ type: "progress", message: "Local LangGraph runtime started" });
    try {
      const toolCalls = await planToolCalls(input, this.registry);
      await context.emit({ type: "progress", message: `Planned ${toolCalls.length} local tool call(s)` });
      return await this.executeToolCalls({
        run,
        agentInput: input,
        context,
        toolCalls,
      });
    } catch (error) {
      if (error instanceof ApprovalRequiredError) {
        const updated = await updateAgentRuntimeRun(run.id, {
          status: "paused",
          pendingApproval: { toolCall: error.toolCall },
        });
        return {
          run: updated ?? run,
          status: "paused",
          assistant: localizeAgentText(input.locale, "agentApprovalRequiredContinue"),
          toolCalls: [{ ...error.toolCall, output: {}, status: "pending" }],
        };
      }

      const message = error instanceof Error ? error.message : String(error);
      await appendAgentRuntimeEvent({ agentRunId: run.id, type: "error", message });
      const updated = await updateAgentRuntimeRun(run.id, { status: "failed", result: { error: message } });
      return { run: updated ?? run, status: "failed", assistant: message, toolCalls: [] };
    }
  }

  async resume(agentRunId: string, approval: { approved: boolean; input?: Record<string, unknown> }): Promise<AgentRunResult> {
    const run = await getAgentRuntimeRun(agentRunId);
    if (!run) throw new Error("Agent run not found");
    await appendAgentRuntimeEvent({
      agentRunId,
      type: "resume",
      message: approval.approved ? "Approval accepted" : "Approval rejected",
      data: approval,
    });
    if (!approval.approved) {
      const updated = await updateAgentRuntimeRun(agentRunId, {
        status: "cancelled",
        pendingApproval: {},
        result: { assistant: localizeAgentText(typeof approval.input?.locale === "string" ? approval.input.locale as Locale : undefined, "agentCancelledByUser") },
      });
      return {
        run: updated ?? run,
        status: "cancelled",
        assistant: localizeAgentText(typeof approval.input?.locale === "string" ? approval.input.locale as Locale : undefined, "agentCancelledByUser"),
        toolCalls: [],
      };
    }

    const state = run.state as Partial<LocalGraphState>;
    const toolCalls = Array.isArray(state.toolCalls) ? state.toolCalls : [];
    const initialResults = Array.isArray(state.toolResults) ? state.toolResults : [];
    const pendingIndex = typeof state.pendingIndex === "number" ? state.pendingIndex : initialResults.length;
    const pendingToolCall = state.pendingToolCall ?? toolCalls[pendingIndex];
    if (!pendingToolCall || toolCalls.length === 0) {
      throw new Error("No pending tool approval found for this run");
    }

    const site = run.siteId ? await getSite(run.siteId) : undefined;
    const [settings, brand, promptSettings] = await Promise.all([
      getLocalAgentSettings(),
      getBrandSettings(),
      getPromptSettings(),
    ]);
    const systemPrompt = buildLocalAgentSystemPrompt({
      customPrompt: promptSettings.systemPrompt,
      brand,
    });
    const agentInput: AgentRunInput = {
      threadId: run.threadId,
      site: site ?? undefined,
      message: typeof run.input.message === "string" ? run.input.message : "",
      params: typeof run.input.params === "object" && run.input.params
        ? run.input.params as Record<string, unknown>
        : {},
      locale: typeof run.input.locale === "string" ? run.input.locale as Locale : undefined,
      chatContext: typeof run.input.chatContext === "object" && run.input.chatContext
        ? run.input.chatContext as AgentRunInput["chatContext"]
        : undefined,
    };
    const updatedRun = await updateAgentRuntimeRun(agentRunId, { status: "running" });
    const context: AgentExecutionContext = {
      agentRunId,
      threadId: run.threadId,
      site: site ?? undefined,
      profilePath: site?.profilePath ?? path.join(browserProfilesRoot(), "default"),
      settings: { runtimeMode: settings.runtimeMode, agentPermissions: settings.agentPermissions },
      systemPrompt,
      emit: (event) => appendAgentRuntimeEvent({ agentRunId, ...event }).then(() => undefined),
    };

    return await this.executeToolCalls({
      run: updatedRun ?? run,
      agentInput,
      context,
      toolCalls,
      initialResults,
      startIndex: pendingIndex,
      approvedToolCallId: pendingToolCall.id,
    });
  }

  async *stream(agentRunId: string, after = 0): AsyncIterable<AgentRuntimeEventRecord> {
    const events = await listAgentRuntimeEvents(agentRunId, after);
    for (const event of events) {
      yield event;
    }
  }
}

class ApprovalRequiredError extends Error {
  constructor(readonly toolCall: PlannedToolCall) {
    super("Approval required");
  }
}
