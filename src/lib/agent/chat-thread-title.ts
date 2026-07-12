import { updateAgentChatThreadTitle } from "@/db/repository";
import { chatTitleSchema, generateStructured } from "@/lib/ai";
import type { Locale } from "@/lib/i18n-config";
import type { AgentChatMessageWithTools, AgentChatThreadRecord } from "@/lib/types";

const genericTitles = new Set(["", "chat", "new chat", "\u804a\u5929", "\u65b0\u804a\u5929"]);
const maxTitleLength = 64;

export function defaultChatThreadTitle(locale: Locale) {
  return locale === "zh-hk" ? "\u804a\u5929" : "Chat";
}

export function normalizeChatThreadTitle(title: string) {
  const cleaned = title.replace(/\s+/g, " ").trim().replace(/[.。!！?？]+$/g, "");
  if (!cleaned) return "";
  return cleaned.length > maxTitleLength ? cleaned.slice(0, maxTitleLength).trim() : cleaned;
}

export function isGenericChatThreadTitle(title: string) {
  return genericTitles.has(normalizeChatThreadTitle(title).toLowerCase());
}

export function userMessagesForTitle(messages: AgentChatMessageWithTools[]) {
  return messages
    .filter((message) => message.role === "user")
    .map((message) => message.content.trim())
    .filter(Boolean)
    .slice(-6);
}

export function shouldGenerateChatThreadTitle(input: {
  thread: AgentChatThreadRecord;
  messages: AgentChatMessageWithTools[];
  jobDone: boolean;
}) {
  if (!isGenericChatThreadTitle(input.thread.title)) return false;
  const userMessageCount = input.messages.filter((message) => message.role === "user").length;
  return input.jobDone || userMessageCount >= 3;
}

function fallbackTitle(messages: string[], locale: Locale) {
  const prefix = defaultChatThreadTitle(locale);
  const firstMessage = normalizeChatThreadTitle(messages[0] ?? "")
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/@\S+/g, "")
    .trim();
  if (!firstMessage) return prefix;
  const snippet = firstMessage.length > 46 ? firstMessage.slice(0, 46).trim() : firstMessage;
  return `${prefix}: ${snippet}`;
}

export async function generateChatThreadTitle(input: {
  messages: string[];
  locale: Locale;
  preferredTitle?: string;
}) {
  const preferredTitle = normalizeChatThreadTitle(input.preferredTitle ?? "");
  if (preferredTitle && !isGenericChatThreadTitle(preferredTitle)) {
    return preferredTitle;
  }

  const messages = input.messages.map((message) => message.trim()).filter(Boolean);
  if (messages.length === 0) return "";

  try {
    const language = input.locale === "zh-hk" ? "Traditional Chinese for Hong Kong" : "English";
    const result = await generateStructured({
      prompt: [
        "Create one concise title for this chat history.",
        `Language: ${language}.`,
        "Rules: the title field must be 2 to 8 words, no generic title like Chat.",
        "User messages:",
        ...messages.map((message, index) => `${index + 1}. ${message}`),
      ].join("\n"),
      schema: chatTitleSchema,
    });
    const generated = normalizeChatThreadTitle(result.data.title);
    if (generated && !isGenericChatThreadTitle(generated)) {
      return generated;
    }
  } catch {
    // Title generation should never block the chat response.
  }

  return fallbackTitle(messages, input.locale);
}

export async function updateChatThreadTitleIfNeeded(input: {
  thread: AgentChatThreadRecord;
  messages: AgentChatMessageWithTools[];
  locale: Locale;
  jobDone: boolean;
  preferredTitle?: string;
}) {
  if (!shouldGenerateChatThreadTitle(input)) return input.thread;
  const title = await generateChatThreadTitle({
    messages: userMessagesForTitle(input.messages),
    locale: input.locale,
    preferredTitle: input.preferredTitle,
  });
  if (!title || isGenericChatThreadTitle(title)) return input.thread;
  return (await updateAgentChatThreadTitle(input.thread.id, title)) ?? input.thread;
}
