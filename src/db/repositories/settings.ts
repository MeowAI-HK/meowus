import { eq } from "drizzle-orm";
import { db, ensureDatabase } from "@/db/client";
import { appSettings } from "@/db/schema";
import type { AgentPermissions, BrandSettings, LocalAgentSettings, PromptSettings } from "@/lib/types";
import { brandSettingsSchema, localAgentSettingsSchema, promptSettingsSchema } from "@/lib/validation";

const LOCAL_AGENT_SETTINGS_KEY = "local-agent";
const BRAND_SETTINGS_KEY = "brand";
const PROMPT_SETTINGS_KEY = "local-agent-prompt";

export const defaultLocalAgentSettings: LocalAgentSettings = {
  runtimeMode: "local",
  textProvider: "gemini",
  imageProvider: "openai",
  geminiModel: "",
  groqModel: "",
  openAIBaseUrl: "https://api.openai.com/v1",
  openAIModel: "",
  openRouterBaseUrl: "https://openrouter.ai/api/v1",
  openRouterModel: "",
  geminiImageModel: "",
  openAIImageModel: "",
  openAIImageSize: "1024x1024",
  agentPermissions: {
    browserStep: "confirm",
    browserPostContent: "confirm",
    generateImage: "confirm",
    generatePostContent: "confirm",
    schedulePost: "confirm",
  },
};

type LocalAgentSettingsPatch = Partial<Omit<LocalAgentSettings, "agentPermissions">> & {
  agentPermissions?: Partial<AgentPermissions>;
};

function readSettingsJson(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return {};
  }
}

async function readAppSetting(key: string) {
  await ensureDatabase();
  const [row] = await db.select().from(appSettings).where(eq(appSettings.key, key)).limit(1);
  return row ? readSettingsJson(row.valueJson) : {};
}

async function writeAppSetting(key: string, value: unknown) {
  await ensureDatabase();
  const updatedAt = Date.now();
  const valueJson = JSON.stringify(value);
  const [existing] = await db.select().from(appSettings).where(eq(appSettings.key, key)).limit(1);
  if (existing) {
    await db.update(appSettings).set({ valueJson, updatedAt }).where(eq(appSettings.key, key));
  } else {
    await db.insert(appSettings).values({ key, valueJson, updatedAt });
  }
}

function parseLocalAgentSettings(value: unknown): LocalAgentSettings {
  const parsed = localAgentSettingsSchema.safeParse(value);
  const data = parsed.success ? parsed.data : {};
  return {
    ...defaultLocalAgentSettings,
    ...data,
    agentPermissions: {
      ...defaultLocalAgentSettings.agentPermissions,
      ...(data.agentPermissions ?? {}),
    },
  };
}

export async function getLocalAgentSettings() {
  return parseLocalAgentSettings(await readAppSetting(LOCAL_AGENT_SETTINGS_KEY));
}

export async function updateLocalAgentSettings(patch: LocalAgentSettingsPatch) {
  await ensureDatabase();
  const current = await getLocalAgentSettings();
  const next = parseLocalAgentSettings({
    ...current,
    ...patch,
    agentPermissions: {
      ...current.agentPermissions,
      ...(patch.agentPermissions ?? {}),
    },
  });
  await writeAppSetting(LOCAL_AGENT_SETTINGS_KEY, next);
  return next;
}

export const defaultBrandSettings: BrandSettings = {
  name: "",
  description: "",
  targetAudience: "",
  voice: "",
  colors: {
    primary: "",
    accent: "",
    background: "",
  },
};

export async function getBrandSettings(): Promise<BrandSettings> {
  const parsed = brandSettingsSchema.safeParse(await readAppSetting(BRAND_SETTINGS_KEY));
  return {
    ...defaultBrandSettings,
    ...(parsed.success ? parsed.data : {}),
    colors: {
      ...defaultBrandSettings.colors,
      ...(parsed.success ? parsed.data.colors : {}),
    },
  };
}

export async function updateBrandSettings(patch: Partial<BrandSettings>): Promise<BrandSettings> {
  const current = await getBrandSettings();
  const next = brandSettingsSchema.parse({
    ...current,
    ...patch,
    colors: {
      ...current.colors,
      ...(patch.colors ?? {}),
    },
  });
  await writeAppSetting(BRAND_SETTINGS_KEY, next);
  return next;
}

export async function getPromptSettings(): Promise<PromptSettings> {
  const parsed = promptSettingsSchema.safeParse(await readAppSetting(PROMPT_SETTINGS_KEY));
  return parsed.success ? parsed.data : { systemPrompt: "" };
}

export async function updatePromptSettings(patch: Partial<PromptSettings>): Promise<PromptSettings> {
  const current = await getPromptSettings();
  const next = promptSettingsSchema.parse({ ...current, ...patch });
  await writeAppSetting(PROMPT_SETTINGS_KEY, next);
  return next;
}
