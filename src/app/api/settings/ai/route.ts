import { getLocalAgentSettings, updateLocalAgentSettings } from "@/db/repositories/settings";
import { fail, failFromError, ok } from "@/lib/api";
import { readProviderKeys, maskKey, writeProviderKey } from "@/lib/secrets";
import { localAgentSettingsSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function GET() {
  try {
    const [geminiKey, groqKey, openAIKey, openRouterKey] = await Promise.all([
      readProviderKeys("gemini").then((keys) => keys[0] ?? ""),
      readProviderKeys("groq").then((keys) => keys[0] ?? ""),
      readProviderKeys("openai").then((keys) => keys[0] ?? ""),
      readProviderKeys("openrouter").then((keys) => keys[0] ?? ""),
    ]);
    return ok({
      ...(await getLocalAgentSettings()),
      geminiKey: maskKey(geminiKey),
      groqKey: maskKey(groqKey),
      openAIKey: maskKey(openAIKey),
      openRouterKey: maskKey(openRouterKey),
    });
  } catch (error) {
    return failFromError(error, "UNKNOWN_ERROR", 500);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = localAgentSettingsSchema.safeParse(body);
    if (!parsed.success) {
      return fail("INVALID_PAYLOAD", 400, parsed.error);
    }

    const { geminiKey, groqKey, openAIKey, openRouterKey, ...settingsPatch } = parsed.data;
    if (geminiKey?.trim() && !geminiKey.includes("*")) {
      await writeProviderKey("gemini", geminiKey.trim());
    }
    if (groqKey?.trim() && !groqKey.includes("*")) {
      await writeProviderKey("groq", groqKey.trim());
    }
    if (openAIKey?.trim() && !openAIKey.includes("*")) {
      await writeProviderKey("openai", openAIKey.trim());
    }
    if (openRouterKey?.trim() && !openRouterKey.includes("*")) {
      await writeProviderKey("openrouter", openRouterKey.trim());
    }

    const settings = await updateLocalAgentSettings(settingsPatch);
    return ok({ success: true, settings });
  } catch (error) {
    return failFromError(error, "UNKNOWN_ERROR", 500);
  }
}
