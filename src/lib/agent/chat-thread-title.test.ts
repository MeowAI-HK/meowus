import { describe, expect, it } from "vitest";
import {
  isGenericChatThreadTitle,
  defaultChatThreadTitle,
  normalizeChatThreadTitle,
  shouldGenerateChatThreadTitle,
  userMessagesForTitle,
} from "./chat-thread-title";
import type { AgentChatMessageWithTools, AgentChatThreadRecord } from "@/lib/types";

const thread: AgentChatThreadRecord = {
  id: "thread-1",
  title: "Chat",
  createdAt: 1,
  updatedAt: 1,
};

function userMessage(content: string): AgentChatMessageWithTools {
  return {
    id: content,
    threadId: "thread-1",
    role: "user",
    content,
    metadata: {},
    createdAt: 1,
    toolCalls: [],
  };
}

describe("chat thread title helpers", () => {
  it("recognizes default titles as generic", () => {
    expect(isGenericChatThreadTitle("Chat")).toBe(true);
    expect(isGenericChatThreadTitle("\u804a\u5929")).toBe(true);
    expect(isGenericChatThreadTitle("Campaign plan")).toBe(false);
  });

  it("localizes the default placeholder title", () => {
    expect(defaultChatThreadTitle("en")).toBe("Chat");
    expect(defaultChatThreadTitle("zh-hk")).toBe("\u804a\u5929");
  });

  it("collapses whitespace and trims trailing punctuation into one clean line", () => {
    expect(normalizeChatThreadTitle("Threads   launch\nplan.")).toBe("Threads launch plan");
  });

  it("generates when a job is done or the user has sent at least three messages", () => {
    expect(shouldGenerateChatThreadTitle({ thread, messages: [userMessage("one")], jobDone: true })).toBe(true);
    expect(shouldGenerateChatThreadTitle({
      thread,
      messages: [userMessage("one"), userMessage("two"), userMessage("three")],
      jobDone: false,
    })).toBe(true);
  });

  it("uses recent user messages for title context", () => {
    const messages = Array.from({ length: 8 }, (_, index) => userMessage(`message ${index + 1}`));
    expect(userMessagesForTitle(messages)).toEqual([
      "message 3",
      "message 4",
      "message 5",
      "message 6",
      "message 7",
      "message 8",
    ]);
  });
});
