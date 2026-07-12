import { listProviderModels, type ModelCapability } from "@/features/ai-settings/model-catalog";
import { fail, failFromError, ok } from "@/lib/api";
import type { LocalAIProvider, LocalImageProvider } from "@/lib/types";

export const runtime = "nodejs";

const textProviders = new Set<LocalAIProvider>(["gemini", "groq", "openai", "openrouter"]);
const imageProviders = new Set<LocalImageProvider>(["gemini", "openai"]);

function isCapability(value: string | null): value is ModelCapability {
  return value === "text" || value === "image";
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const provider = url.searchParams.get("provider");
    const capability = url.searchParams.get("capability");

    if (!isCapability(capability)) {
      return fail("INVALID_PAYLOAD", 400, { capability });
    }
    if (
      !provider ||
      (capability === "text" && !textProviders.has(provider as LocalAIProvider)) ||
      (capability === "image" && !imageProviders.has(provider as LocalImageProvider))
    ) {
      return fail("INVALID_PAYLOAD", 400, { provider });
    }

    return ok({
      provider,
      capability,
      models: await listProviderModels({
        provider: provider as LocalAIProvider | LocalImageProvider,
        capability,
      }),
    });
  } catch (error) {
    return failFromError(error, "UNKNOWN_ERROR", 500);
  }
}
