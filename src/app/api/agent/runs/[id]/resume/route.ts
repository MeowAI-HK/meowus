import { z } from "zod";
import {
  createAgentChatMessage,
  createAgentToolCall,
  getAgentChatThread,
  listAgentChatMessages,
  updateAgentToolCall,
} from "@/db/repository";
import { updateChatThreadTitleIfNeeded } from "@/lib/agent/chat-thread-title";
import { LangGraphAgentEngine } from "@/lib/agent/langgraph-engine";
import { fail, ok, parseJson } from "@/lib/api";
import type { AgentRunResult } from "@/lib/agent/contracts";
import { normalizeLocale } from "@/lib/locale-resources";
import type { Locale } from "@/lib/i18n-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  approved: z.boolean(),
  input: z.record(z.string(), z.unknown()).optional(),
});

async function syncResumeResultToChat(agentRunId: string, result: AgentRunResult, locale: Locale) {
  const threadId = result.run.threadId;
  if (!threadId) return;

  const messages = await listAgentChatMessages(threadId);
  const pausedMessage = [...messages].reverse().find((message) =>
    message.role === "assistant" && message.metadata.localAgentRunId === agentRunId
  );
  if (!pausedMessage) return;

  const pendingTool = pausedMessage.toolCalls.find((tool) => tool.status === "pending");
  const [firstTool, ...remainingTools] = result.toolCalls;

  if (pendingTool && firstTool) {
    await updateAgentToolCall(pendingTool.id, {
      status: firstTool.status === "pending" ? "pending" : firstTool.status,
      output: firstTool.output,
      creditType: firstTool.name.includes("image") ? "image" : undefined,
      creditCost: firstTool.name.includes("image") ? 0 : undefined,
    });
  } else if (pendingTool && result.status === "cancelled") {
    await updateAgentToolCall(pendingTool.id, {
      status: "failed",
      output: { cancelled: true, message: result.assistant },
    });
  }

  if (result.status !== "success" && result.status !== "paused") return;

  const assistant = await createAgentChatMessage({
    threadId,
    role: "assistant",
    content: result.assistant,
    siteId: result.run.siteId,
    mode: "local",
    metadata: {
      localAgentRunId: agentRunId,
      localAgentStatus: result.status,
      resumedFromMessageId: pausedMessage.id,
    },
  });

  const toolsToCreate = pendingTool && firstTool ? remainingTools : result.toolCalls;
  for (const tool of toolsToCreate) {
    await createAgentToolCall({
      threadId,
      messageId: assistant.id,
      name: tool.name,
      status: tool.status,
      siteId: result.run.siteId,
      input: tool.input,
      output: tool.output,
      creditType: tool.name.includes("image") ? "image" : undefined,
      creditCost: tool.name.includes("image") ? 0 : undefined,
    });
  }

  const thread = await getAgentChatThread(threadId);
  if (thread) {
    await updateChatThreadTitleIfNeeded({
      thread,
      messages,
      locale,
      jobDone: result.status === "success",
    });
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const parsed = await parseJson(request, schema);
  if (parsed.error) return fail("Invalid resume payload", 400, parsed.error);

  try {
    const locale = normalizeLocale(
      typeof parsed.data.input?.locale === "string" ? parsed.data.input.locale : undefined,
    );
    const result = await new LangGraphAgentEngine().resume(id, {
      ...parsed.data,
      input: { ...(parsed.data.input ?? {}), locale },
    });
    await syncResumeResultToChat(id, result, locale);
    return ok(result);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Failed to resume agent run", 500);
  }
}
