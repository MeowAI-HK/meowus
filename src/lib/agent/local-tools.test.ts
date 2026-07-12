import { describe, expect, it, vi } from "vitest";
import { createDefaultToolRegistry } from "./local-tools";
import type { AgentExecutionContext } from "./contracts";

const baseContext: AgentExecutionContext = {
  agentRunId: "run_1",
  profilePath: "profile",
  settings: {
    runtimeMode: "local",
    agentPermissions: {
      browserStep: "confirm",
      browserPostContent: "confirm",
      generateImage: "confirm",
      generatePostContent: "confirm",
    },
  },
  systemPrompt: "Test system prompt",
  emit: vi.fn(),
};

describe("local tool approval policy", () => {
  it("guards all local operations by default", () => {
    const registry = createDefaultToolRegistry();
    expect(
      registry.requiresApproval(
        "browser_click",
        { selector: "button[type=submit]", isFinalPublish: true },
        baseContext,
      ),
    ).toBe(true);
    expect(registry.requiresApproval("generate_social_post_draft", { topic: "x" }, baseContext)).toBe(true);
    expect(registry.requiresApproval("generate_image_file", { prompt: "x" }, baseContext)).toBe(true);
    expect(registry.requiresApproval("browser_screenshot", {}, baseContext)).toBe(true);
  });

  it("allows only operations whose permission is auto", () => {
    const registry = createDefaultToolRegistry();
    const context = {
      ...baseContext,
      settings: {
        ...baseContext.settings,
        agentPermissions: { ...baseContext.settings.agentPermissions, browserPostContent: "auto" as const },
      },
    };
    expect(
      registry.requiresApproval(
        "browser_click",
        { selector: "button[type=submit]", isFinalPublish: true },
        context,
      ),
    ).toBe(false);
    expect(registry.requiresApproval("browser_screenshot", {}, context)).toBe(true);
  });

  it("uses the post-content permission for the final Threads publish action", () => {
    const registry = createDefaultToolRegistry();
    const input = { text: "Hello Threads", publish: true };

    expect(registry.requiresApproval("threads_create_post", input, baseContext)).toBe(true);
    expect(registry.requiresApproval("threads_create_post", input, {
      ...baseContext,
      settings: {
        ...baseContext.settings,
        agentPermissions: {
          ...baseContext.settings.agentPermissions,
          browserPostContent: "auto",
        },
      },
    })).toBe(false);
  });
});
