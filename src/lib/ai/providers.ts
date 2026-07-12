import { AppError } from "@/lib/app-errors";
import type { AIProviderAttempt } from "@/features/ai-settings/provider-registry";

export type ProviderCallOptions = {
  prompt: string;
  systemPrompt?: string;
  json?: boolean;
};

function trimBaseUrl(url: string) {
  return url.replace(/\/$/, "");
}

function geminiEndpoint(config: AIProviderAttempt) {
  const root = trimBaseUrl(config.baseUrl);
  const apiRoot = root.endsWith("/v1beta") ? root : `${root}/v1beta`;
  return `${apiRoot}/models/${encodeURIComponent(config.model)}:generateContent?key=${encodeURIComponent(config.key)}`;
}

function extractGeminiText(data: unknown) {
  const candidates = (
    data as { candidates?: Array<{ content?: { parts?: Array<{ text?: string; thought?: boolean }> } }> }
  ).candidates;
  for (const candidate of candidates ?? []) {
    for (const part of candidate.content?.parts ?? []) {
      if (!part.thought && part.text?.trim()) {
        return part.text.trim();
      }
    }
  }
  throw new AppError("AI_PROVIDER_NO_TEXT", { message: "Gemini returned no text" });
}

export async function callGemini(config: AIProviderAttempt, options: ProviderCallOptions) {
  const body: Record<string, unknown> = {
    contents: [{ parts: [{ text: options.prompt }] }],
  };
  if (options.systemPrompt) {
    body.systemInstruction = { parts: [{ text: options.systemPrompt }] };
  }
  if (options.json) {
    body.generationConfig = { responseMimeType: "application/json" };
  }

  const response = await fetch(geminiEndpoint(config), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new AppError("AI_PROVIDER_FAILED", {
      message: `Gemini HTTP ${response.status}: ${JSON.stringify(data).slice(0, 240)}`,
      status: response.status,
      details: data,
    });
  }
  return extractGeminiText(data);
}

export async function callOpenAICompatible(config: AIProviderAttempt, options: ProviderCallOptions) {
  const messages = [
    ...(options.systemPrompt ? [{ role: "system", content: options.systemPrompt }] : []),
    { role: "user", content: options.prompt },
  ];
  const response = await fetch(`${trimBaseUrl(config.baseUrl)}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      temperature: 0.7,
      ...(options.json ? { response_format: { type: "json_object" } } : {}),
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new AppError("AI_PROVIDER_FAILED", {
      message: `OpenAI-compatible HTTP ${response.status}: ${JSON.stringify(data).slice(0, 240)}`,
      status: response.status,
      details: data,
    });
  }
  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new AppError("AI_PROVIDER_NO_TEXT", { message: "OpenAI-compatible provider returned no text" });
  }
  return String(content).trim();
}

export function callProvider(attempt: AIProviderAttempt, options: ProviderCallOptions) {
  return attempt.provider === "gemini"
    ? callGemini(attempt, options)
    : callOpenAICompatible(attempt, options);
}
