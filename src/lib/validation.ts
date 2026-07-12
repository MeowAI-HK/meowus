import { z } from "zod";
import { playbookIds } from "./types";

export const siteInputSchema = z.object({
  name: z.string().trim().min(1),
  platform: z.enum(["Threads", "Facebook", "Instagram", "WordPress", "LinkedIn", "YouTube", "TikTok", "Other"]),
  url: z.string().trim().optional().default(""),
  account: z.string().trim().optional().default(""),
  memo: z.string().trim().optional().default(""),
  status: z.enum(["active", "paused", "needs_login"]).optional().default("needs_login"),
});

export const scheduleTimeSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("daily"), time: z.string().regex(/^\d{2}:\d{2}$/) }),
  z.object({ type: z.literal("once"), at: z.string().datetime() }),
]);

export const scheduleInputSchema = z.object({
  playbookId: z.enum(playbookIds),
  siteId: z.string().trim().optional(),
  enabled: z.boolean().optional().default(true),
  scheduleTimes: z.array(scheduleTimeSchema).min(1),
  params: z.record(z.string(), z.unknown()).optional().default({}),
});

export const runInputSchema = z.object({
  playbookId: z.enum(playbookIds),
  siteId: z.string().trim().optional(),
  scheduleId: z.string().trim().optional(),
  params: z.record(z.string(), z.unknown()).optional().default({}),
});

export const contentGenerateSchema = z.object({
  topic: z.string().trim().min(1),
  keywords: z.string().trim().optional().default(""),
  maxWords: z.number().int().min(50).max(1000).optional().default(300),
  language: z.string().trim().optional().default("繁體中文（香港）"),
  prompt: z.string().trim().optional().default(""),
});

export const importUrlSchema = z.object({
  url: z.string().trim().url(),
  maxWords: z.number().int().min(50).max(1000).optional().default(300),
  language: z.string().trim().optional().default("繁體中文（香港）"),
  rewrite: z.boolean().optional().default(true),
});

export const localAgentSettingsSchema = z.object({
  runtimeMode: z.enum(["local", "cloud"]).optional(),
  textProvider: z.enum(["gemini", "groq", "openai", "openrouter"]).optional(),
  imageProvider: z.enum(["gemini", "openai"]).optional(),
  geminiKey: z.string().optional(),
  groqKey: z.string().optional(),
  openAIKey: z.string().optional(),
  openRouterKey: z.string().optional(),
  geminiModel: z.string().trim().optional(),
  groqModel: z.string().trim().optional(),
  openAIBaseUrl: z.string().trim().url().optional(),
  openAIModel: z.string().trim().optional(),
  openRouterBaseUrl: z.string().trim().url().optional(),
  openRouterModel: z.string().trim().optional(),
  geminiImageModel: z.string().trim().optional(),
  openAIImageModel: z.string().trim().optional(),
  openAIImageSize: z.string().trim().min(1).optional(),
  agentPermissions: z.object({
    browserStep: z.enum(["auto", "confirm"]).optional(),
    browserPostContent: z.enum(["auto", "confirm"]).optional(),
    generateImage: z.enum(["auto", "confirm"]).optional(),
    generatePostContent: z.enum(["auto", "confirm"]).optional(),
    schedulePost: z.enum(["auto", "confirm"]).optional(),
  }).optional(),
});

const optionalHexColorSchema = z.string().trim().refine(
  (value) => value === "" || /^#[0-9a-f]{6}$/i.test(value),
  "Expected a six-digit hex color",
);

export const brandSettingsSchema = z.object({
  name: z.string().trim().max(120).optional().default(""),
  description: z.string().trim().max(4000).optional().default(""),
  targetAudience: z.string().trim().max(2000).optional().default(""),
  voice: z.string().trim().max(2000).optional().default(""),
  colors: z.object({
    primary: optionalHexColorSchema.optional().default(""),
    accent: optionalHexColorSchema.optional().default(""),
    background: optionalHexColorSchema.optional().default(""),
  }).optional().default({ primary: "", accent: "", background: "" }),
  logoPath: z.string().trim().max(1000).optional(),
});

export const promptSettingsSchema = z.object({
  systemPrompt: z.string().trim().max(12000).optional().default(""),
});
