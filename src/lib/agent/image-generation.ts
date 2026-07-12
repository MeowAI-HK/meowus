import fs from "node:fs/promises";
import path from "node:path";
import { nanoid } from "nanoid";
import { getLocalAgentSettings } from "@/db/repositories/settings";
import { resolveFirstAvailableModel } from "@/features/ai-settings/model-catalog";
import { artifactsRoot } from "@/lib/paths";
import { readProviderKeys } from "@/lib/secrets";

function geminiImageEndpoint(baseUrl: string, model: string, key: string) {
  const root = baseUrl.replace(/\/$/, "");
  const apiRoot = root.endsWith("/v1beta") ? root : `${root}/v1beta`;
  return `${apiRoot}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
}

async function writeBase64Image(base64: string, extension = "png") {
  const outDir = artifactsRoot();
  await fs.mkdir(outDir, { recursive: true });
  const filePath = path.join(outDir, `agent-image-${Date.now()}-${nanoid(8)}.${extension}`);
  await fs.writeFile(filePath, Buffer.from(base64, "base64"));
  return filePath;
}

export async function generateImageFile(input: { prompt: string; provider?: "gemini" | "openai" }) {
  const settings = await getLocalAgentSettings();
  const provider = input.provider ?? settings.imageProvider;

  if (provider === "openai") {
    const [key] = await readProviderKeys("openai");
    if (!key) throw new Error("Missing OpenAI-compatible image API key");
    const model = await resolveFirstAvailableModel({
      provider: "openai",
      capability: "image",
      configuredModel: settings.openAIImageModel || process.env.OPENAI_IMAGE_MODEL,
      settings,
    });
    const response = await fetch(`${settings.openAIBaseUrl.replace(/\/$/, "")}/images/generations`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        prompt: input.prompt,
        size: settings.openAIImageSize,
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(`Image endpoint HTTP ${response.status}: ${JSON.stringify(data).slice(0, 240)}`);
    }
    const base64 = data?.data?.[0]?.b64_json;
    if (!base64) {
      throw new Error("Image endpoint returned no base64 image data");
    }
    return {
      provider,
      model,
      path: await writeBase64Image(base64, "png"),
    };
  }

  const [key] = await readProviderKeys("gemini");
  if (!key) throw new Error("Missing Gemini API key");
  const model = await resolveFirstAvailableModel({
    provider: "gemini",
    capability: "image",
    configuredModel: settings.geminiImageModel || process.env.GEMINI_IMAGE_MODEL,
    settings,
  });
  const baseUrl = process.env.GEMINI_BASE_URL ?? "https://generativelanguage.googleapis.com";
  const response = await fetch(geminiImageEndpoint(baseUrl, model, key), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: input.prompt }] }],
      generationConfig: { responseModalities: ["IMAGE", "TEXT"] },
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Gemini image HTTP ${response.status}: ${JSON.stringify(data).slice(0, 240)}`);
  }
  for (const candidate of data?.candidates ?? []) {
    for (const part of candidate?.content?.parts ?? []) {
      const inlineData = part?.inlineData ?? part?.inline_data;
      if (inlineData?.data) {
        const mimeType = String(inlineData.mimeType ?? inlineData.mime_type ?? "image/png");
        const extension = mimeType.includes("jpeg") || mimeType.includes("jpg") ? "jpg" : "png";
        return {
          provider,
          model,
          path: await writeBase64Image(String(inlineData.data), extension),
        };
      }
    }
  }
  throw new Error("Gemini image provider returned no image data");
}
