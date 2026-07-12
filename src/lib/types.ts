export const playbookIds = [
  "topic_article_generator",
  "ai_prompt_proxy",
  "article_scraper_rewriter",
  "ai_url_extractor",
  "topic_search_writer",
  "threads_auto_post",
  "threads_compose_post",
] as const;

export type PlaybookId = (typeof playbookIds)[number];

export const runStatuses = [
  "queued",
  "running",
  "success",
  "warning",
  "failed",
  "cancelled",
] as const;

export type RunStatus = (typeof runStatuses)[number];

export type ScheduleTime =
  | { type: "daily"; time: string }
  | { type: "once"; at: string };

export type SitePlatform =
  | "Threads"
  | "Facebook"
  | "Instagram"
  | "WordPress"
  | "LinkedIn"
  | "YouTube"
  | "TikTok"
  | "Other";

export type SiteStatus = "active" | "paused" | "needs_login";

export type ContentStatus = "draft" | "ready" | "posted" | "failed";

export interface SiteRecord {
  id: string;
  name: string;
  platform: SitePlatform;
  url: string;
  account: string;
  profilePath: string;
  memo: string;
  status: SiteStatus;
  createdAt: number;
  updatedAt: number;
}

export interface ContentItem {
  id: string;
  title: string;
  body: string;
  postReadyText: string;
  sourceUrls: string[];
  imagePath?: string;
  metadata: Record<string, unknown>;
  status: ContentStatus;
  createdAt: number;
  updatedAt: number;
}

export interface ContentPage {
  items: ContentItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ScheduleRecord {
  id: string;
  playbookId: PlaybookId;
  siteId?: string;
  enabled: boolean;
  scheduleTimes: ScheduleTime[];
  params: Record<string, unknown>;
  status: "scheduled" | "queued" | "running" | "posted" | "failed" | "missed" | "cancelled";
  contentItemId?: string;
  publishAuthorized: boolean;
  lastRunAt?: number;
  nextRunAt?: number;
  createdAt: number;
  updatedAt: number;
}

export interface RunRecord {
  id: string;
  playbookId: PlaybookId;
  siteId?: string;
  scheduleId?: string;
  scheduledFor?: number;
  status: RunStatus;
  params: Record<string, unknown>;
  resultMessage: string;
  artifactPath?: string;
  createdAt: number;
  startedAt?: number;
  finishedAt?: number;
  updatedAt: number;
}

export interface RunEventRecord {
  id: string;
  runId: string;
  level: "info" | "warn" | "error" | "success";
  message: string;
  data?: Record<string, unknown>;
  createdAt: number;
}

export type AgentChatRole = "user" | "assistant" | "system" | "tool";
export type AgentChatMode = "local" | "smepost";
export type AgentToolStatus = "pending" | "running" | "completed" | "failed";
export type AgentCreditType = "llm" | "image";
export type AgentRuntimeMode = "local" | "cloud";
export type AgentRunStatus = "queued" | "running" | "paused" | "success" | "failed" | "cancelled";
export type LocalAIProvider = "gemini" | "groq" | "openai" | "openrouter";
export type LocalImageProvider = "gemini" | "openai";
export type AgentPermissionMode = "auto" | "confirm";

export interface AgentPermissions {
  browserStep: AgentPermissionMode;
  browserPostContent: AgentPermissionMode;
  generateImage: AgentPermissionMode;
  generatePostContent: AgentPermissionMode;
  schedulePost: AgentPermissionMode;
}

export interface LocalAgentSettings {
  runtimeMode: AgentRuntimeMode;
  textProvider: LocalAIProvider;
  imageProvider: LocalImageProvider;
  geminiModel: string;
  groqModel: string;
  openAIBaseUrl: string;
  openAIModel: string;
  openRouterBaseUrl: string;
  openRouterModel: string;
  geminiImageModel: string;
  openAIImageModel: string;
  openAIImageSize: string;
  agentPermissions: AgentPermissions;
}

export interface BrandSettings {
  name: string;
  description: string;
  targetAudience: string;
  voice: string;
  colors: {
    primary: string;
    accent: string;
    background: string;
  };
  logoPath?: string;
}

export interface PromptSettings {
  systemPrompt: string;
}

export type AgentEventType =
  | "progress"
  | "tool_start"
  | "tool_end"
  | "approval_required"
  | "resume"
  | "error"
  | "final";

export interface AgentRuntimeRecord {
  id: string;
  threadId?: string;
  siteId?: string;
  status: AgentRunStatus;
  mode: AgentChatMode;
  input: Record<string, unknown>;
  state: Record<string, unknown>;
  pendingApproval: Record<string, unknown>;
  result: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

export interface AgentRuntimeEventRecord {
  id: string;
  agentRunId: string;
  type: AgentEventType;
  message: string;
  data: Record<string, unknown>;
  createdAt: number;
}

export interface AgentChatThreadRecord {
  id: string;
  title: string;
  activeSiteId?: string;
  createdAt: number;
  updatedAt: number;
}

export interface AgentChatMessageRecord {
  id: string;
  threadId: string;
  role: AgentChatRole;
  content: string;
  siteId?: string;
  mode?: AgentChatMode;
  metadata: Record<string, unknown>;
  createdAt: number;
}

export interface AgentToolCallRecord {
  id: string;
  threadId: string;
  messageId: string;
  name: string;
  status: AgentToolStatus;
  siteId?: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  creditType?: AgentCreditType;
  creditCost?: number;
  createdAt: number;
  updatedAt: number;
}

export interface AgentChatMessageWithTools extends AgentChatMessageRecord {
  toolCalls: AgentToolCallRecord[];
}

export interface AutomationContext {
  runId: string;
  site?: SiteRecord;
  params: Record<string, unknown>;
  profilePath: string;
  log: (message: string, level?: RunEventRecord["level"]) => Promise<void>;
  checkStop: () => Promise<boolean>;
}
