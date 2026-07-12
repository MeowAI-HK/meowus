import { describe, expect, it } from "vitest";
import { localAgentSettingsSchema } from "@/lib/validation";

describe("local agent settings validation", () => {
  it("accepts local/cloud runtime and text/image provider config", () => {
    const parsed = localAgentSettingsSchema.parse({
      runtimeMode: "cloud",
      textProvider: "openrouter",
      imageProvider: "gemini",
      openAIBaseUrl: "https://api.example.com/v1",
      openAIModel: "chat-model",
      openRouterBaseUrl: "https://openrouter.ai/api/v1",
      openRouterModel: "router-model",
      geminiModel: "gemini-text-model",
      groqModel: "groq-text-model",
      geminiImageModel: "gemini-image-model",
      openAIImageModel: "image-model",
      openAIImageSize: "1024x1024",
      agentPermissions: {
        browserStep: "confirm",
        browserPostContent: "auto",
        generateImage: "confirm",
        generatePostContent: "confirm",
      },
    });

    expect(parsed.runtimeMode).toBe("cloud");
    expect(parsed.textProvider).toBe("openrouter");
    expect(parsed.openRouterBaseUrl).toBe("https://openrouter.ai/api/v1");
    expect(parsed.imageProvider).toBe("gemini");
    expect(parsed.agentPermissions?.browserPostContent).toBe("auto");
  });

  it("rejects auto runtime mode", () => {
    expect(() => localAgentSettingsSchema.parse({ runtimeMode: "auto" })).toThrow();
  });

  it("rejects invalid provider URLs", () => {
    expect(() => localAgentSettingsSchema.parse({ openAIBaseUrl: "not-a-url" })).toThrow();
  });
});
