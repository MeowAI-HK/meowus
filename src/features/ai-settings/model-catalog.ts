import { aiProviderRegistry, resolveProviderBaseUrl } from "@/features/ai-settings/provider-registry";
import { getLocalAgentSettings } from "@/db/repositories/settings";
import { readProviderKeys } from "@/lib/secrets";
import type { LocalAIProvider, LocalAgentSettings, LocalImageProvider } from "@/lib/types";

export type ModelCapability = "text" | "image";

export type ProviderModel = {
  id: string;
  label: string;
};

type CacheEntry = {
  expiresAt: number;
  models: ProviderModel[];
};

const cache = new Map<string, CacheEntry>();
const cacheMs = 60 * 60 * 1000;

function cacheKey(provider: string, capability: ModelCapability, baseUrl: string, hasKey: boolean) {
  return [provider, capability, baseUrl, hasKey ? "keyed" : "public"].join("|");
}

function rootUrl(baseUrl: string) {
  return baseUrl.replace(/\/$/, "");
}

function isImageLike(value: string) {
  return /\b(image|images|imagen|dall[- ]?e|vision)\b/i.test(value);
}

function isTextLike(value: string) {
  return !/\b(image|images|imagen|dall[- ]?e|embedding|audio|tts|whisper|moderation|realtime|transcribe|sora)\b/i.test(value);
}

function uniqueModels(models: ProviderModel[]) {
  const seen = new Set<string>();
  return models.filter((model) => {
    if (!model.id || seen.has(model.id)) return false;
    seen.add(model.id);
    return true;
  });
}

function normalizeOpenAICompatibleModels(data: unknown, capability: ModelCapability) {
  const rawModels = Array.isArray((data as { data?: unknown[] }).data) ? (data as { data: unknown[] }).data : [];
  const models = rawModels
    .map((item) => {
      const raw = item as { id?: unknown; owned_by?: unknown; created?: unknown };
      const id = typeof raw.id === "string" ? raw.id : "";
      return { id, label: id, created: typeof raw.created === "number" ? raw.created : 0 };
    })
    .filter((model) => capability === "image" ? isImageLike(model.id) : isTextLike(model.id))
    .sort((a, b) => b.created - a.created)
    .map(({ id, label }) => ({ id, label }));
  return uniqueModels(models);
}

function normalizeOpenRouterModels(data: unknown, capability: ModelCapability) {
  const rawModels = Array.isArray((data as { data?: unknown[] }).data) ? (data as { data: unknown[] }).data : [];
  const models = rawModels
    .map((item) => {
      const raw = item as {
        id?: unknown;
        name?: unknown;
        created?: unknown;
        architecture?: { modality?: unknown; input_modalities?: unknown[]; output_modalities?: unknown[] };
      };
      const id = typeof raw.id === "string" ? raw.id : "";
      const label = typeof raw.name === "string" ? raw.name : id;
      const modality = [
        raw.architecture?.modality,
        ...(Array.isArray(raw.architecture?.input_modalities) ? raw.architecture.input_modalities : []),
        ...(Array.isArray(raw.architecture?.output_modalities) ? raw.architecture.output_modalities : []),
      ].join(" ");
      return { id, label, modality, created: typeof raw.created === "number" ? raw.created : 0 };
    })
    .filter((model) => {
      const haystack = `${model.id} ${model.label} ${model.modality}`;
      return capability === "image" ? isImageLike(haystack) : /text/i.test(model.modality) || isTextLike(haystack);
    })
    .sort((a, b) => b.created - a.created)
    .map(({ id, label }) => ({ id, label }));
  return uniqueModels(models);
}

function normalizeGeminiModels(data: unknown, capability: ModelCapability) {
  const rawModels = Array.isArray((data as { models?: unknown[] }).models) ? (data as { models: unknown[] }).models : [];
  const models = rawModels
    .map((item) => {
      const raw = item as {
        name?: unknown;
        baseModelId?: unknown;
        displayName?: unknown;
        description?: unknown;
        supportedGenerationMethods?: unknown[];
      };
      const name = typeof raw.name === "string" ? raw.name.replace(/^models\//, "") : "";
      const id = typeof raw.baseModelId === "string" ? raw.baseModelId : name;
      const label = typeof raw.displayName === "string" ? raw.displayName : id;
      const methods = Array.isArray(raw.supportedGenerationMethods) ? raw.supportedGenerationMethods : [];
      const supportsGenerateContent = methods.includes("generateContent");
      const haystack = `${id} ${label} ${typeof raw.description === "string" ? raw.description : ""}`;
      return { id, label, supportsGenerateContent, haystack };
    })
    .filter((model) => {
      if (!model.supportsGenerateContent) return false;
      return capability === "image" ? isImageLike(model.haystack) : isTextLike(model.haystack);
    })
    .map(({ id, label }) => ({ id, label }));
  return uniqueModels(models);
}

async function fetchJson(url: string, key?: string) {
  const response = await fetch(url, {
    headers: key ? { Authorization: `Bearer ${key}` } : undefined,
    cache: "no-store",
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Model list HTTP ${response.status}: ${JSON.stringify(data).slice(0, 240)}`);
  }
  return data;
}

export async function listProviderModels(input: {
  provider: LocalAIProvider | LocalImageProvider;
  capability: ModelCapability;
  settings?: LocalAgentSettings | null;
}) {
  const settings = input.settings ?? await getLocalAgentSettings();
  const provider = input.provider;
  const keyProvider = provider === "openai" ? "openai" : provider;
  const [key] = await readProviderKeys(keyProvider);
  const baseUrl = provider === "gemini"
    ? process.env.GEMINI_BASE_URL || aiProviderRegistry.gemini.defaultBaseUrl
    : provider === "groq"
      ? process.env.GROQ_BASE_URL || aiProviderRegistry.groq.defaultBaseUrl
      : resolveProviderBaseUrl(provider, settings);
  const keyForCache = cacheKey(provider, input.capability, baseUrl, Boolean(key));
  const cached = cache.get(keyForCache);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.models;
  }

  let models: ProviderModel[];
  if (provider === "gemini") {
    const apiRoot = rootUrl(baseUrl).endsWith("/v1beta") ? rootUrl(baseUrl) : `${rootUrl(baseUrl)}/v1beta`;
    const url = new URL(`${apiRoot}/models`);
    url.searchParams.set("pageSize", "1000");
    if (key) url.searchParams.set("key", key);
    models = normalizeGeminiModels(await fetchJson(url.toString()), input.capability);
  } else if (provider === "openrouter") {
    const url = new URL(`${rootUrl(baseUrl)}/models`);
    if (input.capability === "image") url.searchParams.set("modalities", "image");
    models = normalizeOpenRouterModels(await fetchJson(url.toString(), key), input.capability);
  } else {
    models = normalizeOpenAICompatibleModels(await fetchJson(`${rootUrl(baseUrl)}/models`, key), input.capability);
  }

  cache.set(keyForCache, { expiresAt: Date.now() + cacheMs, models });
  return models;
}

export async function resolveFirstAvailableModel(input: {
  provider: LocalAIProvider | LocalImageProvider;
  capability: ModelCapability;
  configuredModel?: string;
  settings?: LocalAgentSettings | null;
}) {
  const configured = input.configuredModel?.trim();
  if (configured) return configured;
  const [first] = await listProviderModels(input);
  if (!first) {
    throw new Error(`No ${input.capability} models returned by ${input.provider}`);
  }
  return first.id;
}
