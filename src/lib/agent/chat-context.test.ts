import { describe, expect, it } from "vitest";
import { buildAgentChatContext, buildCloudAgentChatContext, formatAgentChatContext } from "./chat-context";
import type { AgentChatMessageWithTools } from "@/lib/types";

function message(input: Partial<AgentChatMessageWithTools>): AgentChatMessageWithTools {
  return {
    id: input.id ?? "message",
    threadId: "thread",
    role: input.role ?? "assistant",
    content: input.content ?? "",
    metadata: {},
    createdAt: input.createdAt ?? 1,
    toolCalls: input.toolCalls ?? [],
  };
}

describe("agent chat context", () => {
  it("keeps visible chat and useful generated artifacts without raw tool JSON", () => {
    const context = buildAgentChatContext([
      message({ role: "user", content: "Generate a post about a curious orange cat." }),
      message({
        role: "assistant",
        content: "Curious cat post ready.",
        toolCalls: [
          {
            id: "tool-1",
            threadId: "thread",
            messageId: "message",
            name: "generate_social_post_draft",
            status: "completed",
            input: { topic: "cat" },
            output: {
              postReadyText: "A curious orange cat explores a sunny windowsill.",
              itemId: "content-1",
            },
            createdAt: 1,
            updatedAt: 1,
          },
          {
            id: "tool-2",
            threadId: "thread",
            messageId: "message",
            name: "generate_image_file",
            status: "completed",
            input: { prompt: "internal prompt" },
            output: { path: "C:/tmp/cat.png" },
            createdAt: 1,
            updatedAt: 1,
          },
        ],
      }),
    ]);

    const formatted = formatAgentChatContext(context);
    expect(context.latestPostText).toContain("orange cat");
    expect(context.latestContentItemId).toBe("content-1");
    expect(context.latestImagePath).toBe("C:/tmp/cat.png");
    expect(formatted).toContain("Generate a post about a curious orange cat.");
    expect(formatted).not.toContain('"topic"');
    expect(formatted).not.toContain("internal prompt");
  });

  it("keeps local content linkage out of the cloud context contract", () => {
    const cloud = buildCloudAgentChatContext({
      messages: [{ role: "user", content: "Create a post" }],
      latestPostText: "Post",
      latestContentItemId: "local-content-id",
      latestImagePath: "C:/tmp/image.png",
    });
    expect(cloud).toEqual({
      messages: [{ role: "user", content: "Create a post" }],
      latestPostText: "Post",
      latestImagePrompt: undefined,
      latestImagePath: "C:/tmp/image.png",
    });
    expect(cloud).not.toHaveProperty("latestContentItemId");
  });
});
