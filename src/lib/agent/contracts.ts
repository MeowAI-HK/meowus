import type { z } from "zod";
import type {
  AgentRuntimeEventRecord,
  AgentRuntimeRecord,
  AgentRunStatus,
  AgentRuntimeMode,
  SiteRecord,
} from "@/lib/types";
import type { Locale } from "@/lib/i18n-config";
import type { AgentChatContext } from "./chat-context";

export type AgentToolDefinition<
  TInput extends z.ZodType = z.ZodType,
  TOutput extends z.ZodType = z.ZodType,
> = {
  name: string;
  description: string;
  inputSchema: TInput;
  outputSchema: TOutput;
  requiresApproval?: (input: z.infer<TInput>, context: AgentExecutionContext) => boolean;
  execute: (input: z.infer<TInput>, context: AgentExecutionContext) => Promise<z.infer<TOutput>>;
};

export type AgentExecutionContext = {
  agentRunId: string;
  threadId?: string;
  site?: SiteRecord;
  approvedToolCallId?: string;
  profilePath: string;
  settings: {
    runtimeMode: AgentRuntimeMode;
    agentPermissions: {
      browserStep: "auto" | "confirm";
      browserPostContent: "auto" | "confirm";
      generateImage: "auto" | "confirm";
      generatePostContent: "auto" | "confirm";
    };
  };
  systemPrompt: string;
  emit: (event: {
    type: AgentRuntimeEventRecord["type"];
    message?: string;
    data?: Record<string, unknown>;
  }) => Promise<void>;
};

export type PlannedToolCall = {
  id: string;
  name: string;
  input: Record<string, unknown>;
};

export type AgentRunInput = {
  threadId?: string;
  site?: SiteRecord;
  message: string;
  params?: Record<string, unknown>;
  locale?: Locale;
  chatContext?: AgentChatContext;
};

export type AgentRunResult = {
  run: AgentRuntimeRecord;
  status: AgentRunStatus;
  assistant: string;
  toolCalls: Array<{
    id: string;
    name: string;
    input: Record<string, unknown>;
    output: Record<string, unknown>;
    status: "completed" | "failed" | "pending";
  }>;
};

export interface AgentEngine {
  run(input: AgentRunInput): Promise<AgentRunResult>;
  resume(agentRunId: string, approval: { approved: boolean; input?: Record<string, unknown> }): Promise<AgentRunResult>;
  stream(agentRunId: string, after?: number): AsyncIterable<AgentRuntimeEventRecord>;
}
