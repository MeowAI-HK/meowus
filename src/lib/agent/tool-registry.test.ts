import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { ToolRegistry } from "./tool-registry";
import type { AgentExecutionContext } from "./contracts";

const context: AgentExecutionContext = {
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

describe("ToolRegistry", () => {
  it("rejects duplicate tool names", () => {
    const registry = new ToolRegistry();
    const tool = {
      name: "example",
      description: "Example",
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ ok: z.boolean() }),
      execute: vi.fn(async () => ({ ok: true })),
    };

    registry.register(tool);
    expect(() => registry.register(tool)).toThrow("Tool already registered");
  });

  it("validates input and output schemas", async () => {
    const registry = new ToolRegistry().register({
      name: "example",
      description: "Example",
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ upper: z.string() }),
      execute: vi.fn(async (input) => ({ upper: input.value.toUpperCase() })),
    });

    await expect(registry.execute("example", { value: "ok" }, context)).resolves.toEqual({ upper: "OK" });
    await expect(registry.execute("example", { value: 123 }, context)).rejects.toThrow();
  });

  it("reports approval requirement from tool policy", () => {
    const registry = new ToolRegistry().register({
      name: "publish",
      description: "Publish",
      inputSchema: z.object({ isFinalPublish: z.boolean() }),
      outputSchema: z.object({ ok: z.boolean() }),
      requiresApproval: (input, ctx) => input.isFinalPublish && ctx.settings.agentPermissions.browserPostContent !== "auto",
      execute: vi.fn(async () => ({ ok: true })),
    });

    expect(registry.requiresApproval("publish", { isFinalPublish: true }, context)).toBe(true);
    expect(registry.requiresApproval("publish", { isFinalPublish: false }, context)).toBe(false);
    expect(
      registry.requiresApproval("publish", { isFinalPublish: true }, {
        ...context,
        settings: {
          ...context.settings,
          agentPermissions: { ...context.settings.agentPermissions, browserPostContent: "auto" },
        },
      }),
    ).toBe(false);
  });
});
