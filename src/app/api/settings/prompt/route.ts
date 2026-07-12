import { getPromptSettings, updatePromptSettings } from "@/db/repositories/settings";
import { fail, failFromError, ok, parseJson } from "@/lib/api";
import { DEFAULT_LOCAL_AGENT_SYSTEM_PROMPT } from "@/lib/agent/system-prompt";
import { promptSettingsSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function responseSettings(settings: Awaited<ReturnType<typeof getPromptSettings>>) {
  return {
    ...settings,
    defaultSystemPrompt: DEFAULT_LOCAL_AGENT_SYSTEM_PROMPT,
    usingDefault: !settings.systemPrompt.trim(),
  };
}

export async function GET() {
  try {
    return ok(responseSettings(await getPromptSettings()));
  } catch (error) {
    return failFromError(error);
  }
}

export async function POST(request: Request) {
  const parsed = await parseJson(request, promptSettingsSchema);
  if (parsed.error) return fail("INVALID_PAYLOAD", 400, parsed.error);
  try {
    return ok(responseSettings(await updatePromptSettings(parsed.data)));
  } catch (error) {
    return failFromError(error);
  }
}
