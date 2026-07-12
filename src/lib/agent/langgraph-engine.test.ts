import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/ai", async () => {
  const actual = await vi.importActual<typeof import("@/lib/ai")>("@/lib/ai");
  return { ...actual, generateStructured: vi.fn() };
});

import { generateStructured } from "@/lib/ai";
import { planToolCalls } from "./langgraph-engine";
import { createDefaultToolRegistry } from "./local-tools";
import type { ToolPlanStep } from "@/lib/ai";
import type { SiteRecord } from "@/lib/types";

const registry = createDefaultToolRegistry();
const mockedGenerateStructured = vi.mocked(generateStructured);

function planSteps(steps: ToolPlanStep[]) {
  mockedGenerateStructured.mockResolvedValue({
    data: { steps },
    provider: "gemini",
    model: "test-model",
    keyLabel: "****",
  } as Awaited<ReturnType<typeof generateStructured>>);
}

const threadsSite: SiteRecord = {
  id: "site-1",
  name: "clipversity.study",
  platform: "Threads",
  url: "https://www.threads.com/@clipversity.study",
  account: "clipversity.study",
  profilePath: "C:/profiles/site-1",
  memo: "",
  status: "active",
  createdAt: 1,
  updatedAt: 1,
};

describe("local agent LLM tool planning", () => {
  beforeEach(() => {
    mockedGenerateStructured.mockReset();
  });

  it("wires an image plan to the latest post context instead of drafting a new post", async () => {
    planSteps([
      { tool: "generate_image_prompt", input: {} },
      { tool: "generate_image_file", input: {} },
    ]);

    const calls = await planToolCalls(
      {
        message: "Generate the image",
        site: threadsSite,
        chatContext: {
          messages: [],
          latestPostText: "A curious orange cat explores a sunny windowsill.",
        },
      },
      registry,
    );

    expect(calls.some((call) => call.name === "generate_social_post_draft")).toBe(false);
    const imagePrompt = calls.find((call) => call.name === "generate_image_prompt");
    expect(String(imagePrompt?.input.topic)).toContain("orange cat");
    expect(imagePrompt?.input.postContext).toBe("A curious orange cat explores a sunny windowsill.");
    const imageFile = calls.find((call) => call.name === "generate_image_file");
    expect(imageFile?.input.promptFromImagePrompt).toBe(true);
  });

  it("posts existing generated text and image from context", async () => {
    planSteps([{ tool: "threads_create_post", input: { publish: true } }]);

    const calls = await planToolCalls(
      {
        message: "Post it now",
        site: threadsSite,
        params: { publish: true },
        chatContext: {
          messages: [],
          latestPostText: "A curious orange cat explores a sunny windowsill.",
          latestImagePath: "C:/tmp/cat.png",
        },
      },
      registry,
    );

    expect(calls.some((call) => call.name === "generate_social_post_draft")).toBe(false);
    const post = calls.find((call) => call.name === "threads_create_post");
    expect(post?.input.textFromContext).toBe(true);
    expect(post?.input.imageFromContext).toBe(true);
    expect(post?.input.publish).toBe(true);
  });

  it("lets an explicit publish parameter override the planned publish flag", async () => {
    planSteps([{ tool: "threads_create_post", input: { publish: true } }]);
    const draftCalls = await planToolCalls(
      { message: "draft a post", site: threadsSite, params: { publish: false } },
      registry,
    );
    expect(draftCalls.find((call) => call.name === "threads_create_post")?.input.publish).toBe(false);

    planSteps([{ tool: "threads_create_post", input: { publish: false } }]);
    const publishCalls = await planToolCalls(
      { message: "publish this post", site: threadsSite, params: { publish: true } },
      registry,
    );
    expect(publishCalls.find((call) => call.name === "threads_create_post")?.input.publish).toBe(true);
  });

  it("falls back to a single draft when the planner returns no usable tools", async () => {
    planSteps([{ tool: "unknown_tool", input: {} }]);
    const calls = await planToolCalls({ message: "write something about cats" }, registry);
    expect(calls).toHaveLength(1);
    expect(calls[0].name).toBe("generate_social_post_draft");
  });

  it("falls back to a single draft when the planner call fails", async () => {
    mockedGenerateStructured.mockRejectedValue(new Error("no api key"));
    const calls = await planToolCalls({ message: "write something about cats" }, registry);
    expect(calls).toHaveLength(1);
    expect(calls[0].name).toBe("generate_social_post_draft");
  });
});
