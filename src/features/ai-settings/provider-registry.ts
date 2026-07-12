import type { LocalAIProvider, LocalAgentSettings } from "@/lib/types";

export type AIProviderConfig = {
  provider: LocalAIProvider;
  displayNameKey: string;
  keyField: "geminiKey" | "groqKey" | "openAIKey" | "openRouterKey";
  defaultBaseUrl: string;
  baseUrlEnv?: string;
  modelEnv?: string;
  supportsCustomBaseUrl: boolean;
};

export type AIProviderAttempt = {
  provider: LocalAIProvider;
  key: string;
  model: string;
  baseUrl: string;
};

export const aiProviderRegistry = {
  gemini: {
    provider: "gemini",
    displayNameKey: "providerGemini",
    keyField: "geminiKey",
    defaultBaseUrl: "https://generativelanguage.googleapis.com",
    baseUrlEnv: "GEMINI_BASE_URL",
    modelEnv: "GEMINI_MODEL",
    supportsCustomBaseUrl: false,
  },
  groq: {
    provider: "groq",
    displayNameKey: "providerGroq",
    keyField: "groqKey",
    defaultBaseUrl: "https://api.groq.com/openai/v1",
    baseUrlEnv: "GROQ_BASE_URL",
    modelEnv: "GROQ_MODEL",
    supportsCustomBaseUrl: false,
  },
  openai: {
    provider: "openai",
    displayNameKey: "providerOpenAI",
    keyField: "openAIKey",
    defaultBaseUrl: "https://api.openai.com/v1",
    baseUrlEnv: "OPENAI_BASE_URL",
    modelEnv: "OPENAI_MODEL",
    supportsCustomBaseUrl: true,
  },
  openrouter: {
    provider: "openrouter",
    displayNameKey: "providerOpenRouter",
    keyField: "openRouterKey",
    defaultBaseUrl: "https://openrouter.ai/api/v1",
    baseUrlEnv: "OPENROUTER_BASE_URL",
    modelEnv: "OPENROUTER_MODEL",
    supportsCustomBaseUrl: true,
  },
} satisfies Record<LocalAIProvider, AIProviderConfig>;

export const aiProviderOrder: LocalAIProvider[] = ["gemini", "groq", "openai", "openrouter"];

function envValue(name: string | undefined) {
  return name ? process.env[name] : undefined;
}

export function resolveProviderBaseUrl(provider: LocalAIProvider, settings?: LocalAgentSettings | null) {
  const config = aiProviderRegistry[provider];
  if (provider === "openai") {
    return settings?.openAIBaseUrl || envValue(config.baseUrlEnv) || config.defaultBaseUrl;
  }
  if (provider === "openrouter") {
    return settings?.openRouterBaseUrl || envValue(config.baseUrlEnv) || config.defaultBaseUrl;
  }
  return envValue(config.baseUrlEnv) || config.defaultBaseUrl;
}

export function resolveProviderModel(provider: LocalAIProvider, settings?: LocalAgentSettings | null) {
  const config = aiProviderRegistry[provider];
  if (provider === "gemini") {
    return settings?.geminiModel || envValue(config.modelEnv) || "";
  }
  if (provider === "groq") {
    return settings?.groqModel || envValue(config.modelEnv) || "";
  }
  if (provider === "openai") {
    return settings?.openAIModel || envValue(config.modelEnv) || "";
  }
  if (provider === "openrouter") {
    return settings?.openRouterModel || envValue(config.modelEnv) || "";
  }
  return envValue(config.modelEnv) || "";
}

export function orderedProviders(preferred?: LocalAIProvider, settings?: LocalAgentSettings | null) {
  return Array.from(new Set([preferred ?? settings?.textProvider ?? "gemini", ...aiProviderOrder]));
}
