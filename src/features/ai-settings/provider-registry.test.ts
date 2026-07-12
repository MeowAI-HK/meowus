import { describe, expect, it } from "vitest";
import { aiProviderRegistry, orderedProviders, resolveProviderBaseUrl, resolveProviderModel } from "./provider-registry";

describe("ai provider registry", () => {
  it("keeps provider metadata centralized", () => {
    expect(aiProviderRegistry.openrouter.supportsCustomBaseUrl).toBe(true);
    expect(aiProviderRegistry.gemini.modelEnv).toBe("GEMINI_MODEL");
  });

  it("orders preferred provider before fallback providers", () => {
    expect(orderedProviders("openrouter").slice(0, 2)).toEqual(["openrouter", "gemini"]);
  });

  it("resolves custom OpenAI-compatible settings", () => {
    const settings = {
      openAIBaseUrl: "https://example.com/v1",
      openAIModel: "custom-model",
    };
    expect(resolveProviderBaseUrl("openai", settings as never)).toBe("https://example.com/v1");
    expect(resolveProviderModel("openai", settings as never)).toBe("custom-model");
  });

  it("does not hardcode provider model fallbacks", () => {
    expect(resolveProviderModel("gemini", null)).toBe("");
    expect(resolveProviderModel("groq", null)).toBe("");
  });
});
