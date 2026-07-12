import type { AgentChatMessageWithTools } from "@/lib/types";

export type AgentChatContextMessage = {
  role: "user" | "assistant";
  content: string;
};

export type AgentChatContext = {
  messages: AgentChatContextMessage[];
  latestPostText?: string;
  latestContentItemId?: string;
  latestImagePrompt?: string;
  latestImagePath?: string;
};

const maxMessageChars = 1600;
const maxContextMessages = 8;

function cleanText(value: unknown, maxChars = maxMessageChars) {
  if (typeof value !== "string") return "";
  return value
    .replace(/```(?:json|tool|javascript|ts|typescript)?[\s\S]*?```/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxChars)
    .trim();
}

function readOutputString(output: Record<string, unknown>, key: string, maxChars?: number) {
  return cleanText(output[key], maxChars ?? (key === "path" ? 500 : maxMessageChars));
}

export function buildAgentChatContext(messages: AgentChatMessageWithTools[]): AgentChatContext {
  const context: AgentChatContext = { messages: [] };
  const recent = messages.slice(-maxContextMessages);

  for (const message of recent) {
    if (message.role === "user" || message.role === "assistant") {
      const content = cleanText(message.content);
      if (content) {
        context.messages.push({ role: message.role, content });
      }
    }

    for (const tool of message.toolCalls) {
      if (tool.status !== "completed") continue;
      const output = tool.output ?? {};

      if (tool.name === "generate_social_post_draft") {
        context.latestPostText = readOutputString(output, "postReadyText")
          || readOutputString(output, "body")
          || context.latestPostText;
        context.latestContentItemId = readOutputString(output, "itemId", 200) || context.latestContentItemId;
      }
      if (tool.name === "generate_image_prompt") {
        context.latestImagePrompt = readOutputString(output, "prompt") || context.latestImagePrompt;
      }
      if (tool.name === "generate_image_file") {
        context.latestImagePath = readOutputString(output, "path") || context.latestImagePath;
      }
      if (tool.name === "threads_create_post") {
        context.latestPostText = readOutputString(output, "text") || context.latestPostText;
      }
    }
  }

  return context;
}

export function formatAgentChatContext(context?: AgentChatContext) {
  if (!context) return "";
  const lines = [
    ...context.messages.map((message) => `${message.role === "user" ? "User" : "Assistant"}: ${message.content}`),
    context.latestPostText ? `Latest post-ready text: ${context.latestPostText}` : "",
    context.latestImagePrompt ? `Latest image prompt: ${context.latestImagePrompt}` : "",
    context.latestImagePath ? `Latest generated image file: ${context.latestImagePath}` : "",
  ].filter(Boolean);

  return lines.join("\n").slice(0, 6000).trim();
}

export function buildCloudAgentChatContext(context?: AgentChatContext) {
  if (!context) return undefined;
  return {
    messages: context.messages,
    latestPostText: context.latestPostText,
    latestImagePrompt: context.latestImagePrompt,
    latestImagePath: context.latestImagePath,
  };
}
