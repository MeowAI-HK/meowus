import { z } from "zod";
import { getLocalAgentSettings } from "@/db/repositories/settings";
import { resolveFirstAvailableModel } from "@/features/ai-settings/model-catalog";
import {
  orderedProviders,
  resolveProviderBaseUrl,
  resolveProviderModel,
  type AIProviderAttempt,
} from "@/features/ai-settings/provider-registry";
import { AppError } from "@/lib/app-errors";
import { maskKey, readProviderKeys } from "@/lib/secrets";
import type { LocalAIProvider } from "@/lib/types";
import { callProvider } from "./providers";

type Provider = LocalAIProvider;

export class MissingAIKeyError extends Error {
  constructor(provider: Provider) {
    super(`Missing ${provider} API key`);
    this.name = "MissingAIKeyError";
  }
}

export type GenerateMeta = {
  provider: Provider;
  model: string;
  keyLabel: string;
};

function shuffle<T>(items: T[]) {
  return [...items].sort(() => Math.random() - 0.5);
}

async function providerAttempts(preferred: Provider | undefined, settings: Awaited<ReturnType<typeof getLocalAgentSettings>> | null) {
  const attempts: AIProviderAttempt[] = [];
  for (const provider of orderedProviders(preferred, settings)) {
    const keys = shuffle(await readProviderKeys(provider));
    const configuredModel = resolveProviderModel(provider, settings);
    const baseUrl = resolveProviderBaseUrl(provider, settings);
    attempts.push(...keys.map((key) => ({ provider, key, model: configuredModel, baseUrl })));
  }
  return attempts;
}

async function runWithProviders<T>(
  preferred: Provider | undefined,
  run: (attempt: AIProviderAttempt, meta: GenerateMeta) => Promise<T>,
): Promise<T> {
  const settings = await getLocalAgentSettings().catch(() => null);
  const attempts = await providerAttempts(preferred, settings);
  if (attempts.length === 0) {
    throw new MissingAIKeyError(preferred ?? "gemini");
  }

  const errors: string[] = [];
  for (const rawAttempt of attempts) {
    try {
      const model = await resolveFirstAvailableModel({
        provider: rawAttempt.provider,
        capability: "text",
        configuredModel: rawAttempt.model,
        settings,
      });
      const attempt = { ...rawAttempt, model };
      return await run(attempt, { provider: attempt.provider, model, keyLabel: maskKey(attempt.key) });
    } catch (error) {
      errors.push(`${rawAttempt.provider}[${maskKey(rawAttempt.key)}]: ${(error as Error).message}`);
    }
  }

  throw new Error(errors.join(" | "));
}

export async function generateText(input: {
  prompt: string;
  systemPrompt?: string;
  provider?: Provider;
}) {
  return runWithProviders(input.provider, async (attempt, meta) => {
    const text = await callProvider(attempt, { prompt: input.prompt, systemPrompt: input.systemPrompt });
    return { text, ...meta };
  });
}

type ParseResult<T> = { ok: true; data: T } | { ok: false; error: string };

function parseStructured<T extends z.ZodType>(schema: T, raw: string): ParseResult<z.infer<T>> {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (error) {
    return { ok: false, error: `invalid JSON: ${(error as Error).message}` };
  }
  const result = schema.safeParse(json);
  if (!result.success) {
    const message = result.error.issues
      .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("; ");
    return { ok: false, error: message };
  }
  return { ok: true, data: result.data };
}

export async function generateStructured<T extends z.ZodType>(input: {
  prompt: string;
  systemPrompt?: string;
  schema: T;
  provider?: Provider;
}): Promise<{ data: z.infer<T> } & GenerateMeta> {
  const jsonSchema = JSON.stringify(z.toJSONSchema(input.schema));
  const instruction = [
    "Return ONLY a single valid JSON object that conforms to the JSON schema below.",
    "Do not include markdown code fences, comments, or any text outside the JSON object.",
    `JSON schema: ${jsonSchema}`,
  ].join("\n");
  const basePrompt = `${input.prompt}\n\n${instruction}`;

  return runWithProviders(input.provider, async (attempt, meta) => {
    const first = await callProvider(attempt, {
      prompt: basePrompt,
      systemPrompt: input.systemPrompt,
      json: true,
    });
    const firstParse = parseStructured(input.schema, first);
    if (firstParse.ok) {
      return { data: firstParse.data, ...meta };
    }

    const retryPrompt = [
      basePrompt,
      "",
      `Your previous reply could not be used (${firstParse.error}).`,
      "Reply again with ONLY the corrected JSON object and nothing else.",
    ].join("\n");
    const second = await callProvider(attempt, {
      prompt: retryPrompt,
      systemPrompt: input.systemPrompt,
      json: true,
    });
    const secondParse = parseStructured(input.schema, second);
    if (secondParse.ok) {
      return { data: secondParse.data, ...meta };
    }

    throw new AppError("AI_STRUCTURED_OUTPUT_INVALID", {
      message: `Structured output validation failed: ${secondParse.error}`,
    });
  });
}
