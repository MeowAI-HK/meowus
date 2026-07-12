import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const sites = sqliteTable("sites", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  platform: text("platform").notNull(),
  url: text("url").notNull().default(""),
  account: text("account").notNull().default(""),
  profilePath: text("profile_path").notNull().default(""),
  memo: text("memo").notNull().default(""),
  status: text("status").notNull().default("needs_login"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const aiProviders = sqliteTable("ai_providers", {
  id: text("id").primaryKey(),
  provider: text("provider").notNull(),
  model: text("model").notNull(),
  baseUrl: text("base_url").notNull(),
  status: text("status").notNull().default("unknown"),
  disabled: integer("disabled", { mode: "boolean" }).notNull().default(false),
  keyCount: integer("key_count").notNull().default(0),
  lastCheckAt: integer("last_check_at"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const contentItems = sqliteTable("content_items", {
  id: text("id").primaryKey(),
  title: text("title").notNull().default(""),
  body: text("body").notNull().default(""),
  postReadyText: text("post_ready_text").notNull().default(""),
  sourceUrlsJson: text("source_urls_json").notNull().default("[]"),
  imagePath: text("image_path").notNull().default(""),
  metadataJson: text("metadata_json").notNull().default("{}"),
  status: text("status").notNull().default("draft"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const schedules = sqliteTable("schedules", {
  id: text("id").primaryKey(),
  playbookId: text("playbook_id").notNull(),
  siteId: text("site_id"),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  scheduleTimesJson: text("schedule_times_json").notNull().default("[]"),
  paramsJson: text("params_json").notNull().default("{}"),
  status: text("status").notNull().default("scheduled"),
  contentItemId: text("content_item_id"),
  publishAuthorized: integer("publish_authorized", { mode: "boolean" }).notNull().default(false),
  lastRunAt: integer("last_run_at"),
  nextRunAt: integer("next_run_at"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const runs = sqliteTable("runs", {
  id: text("id").primaryKey(),
  playbookId: text("playbook_id").notNull(),
  siteId: text("site_id"),
  scheduleId: text("schedule_id"),
  scheduledFor: integer("scheduled_for"),
  status: text("status").notNull().default("queued"),
  paramsJson: text("params_json").notNull().default("{}"),
  resultMessage: text("result_message").notNull().default(""),
  artifactPath: text("artifact_path").notNull().default(""),
  createdAt: integer("created_at").notNull(),
  startedAt: integer("started_at"),
  finishedAt: integer("finished_at"),
  updatedAt: integer("updated_at").notNull(),
});

export const runEvents = sqliteTable("run_events", {
  id: text("id").primaryKey(),
  runId: text("run_id").notNull(),
  level: text("level").notNull().default("info"),
  message: text("message").notNull(),
  dataJson: text("data_json").notNull().default("{}"),
  createdAt: integer("created_at").notNull(),
});

export const chatThreads = sqliteTable("chat_threads", {
  id: text("id").primaryKey(),
  title: text("title").notNull().default(""),
  activeSiteId: text("active_site_id"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const chatMessages = sqliteTable("chat_messages", {
  id: text("id").primaryKey(),
  threadId: text("thread_id").notNull(),
  role: text("role").notNull(),
  content: text("content").notNull().default(""),
  siteId: text("site_id"),
  mode: text("mode"),
  metadataJson: text("metadata_json").notNull().default("{}"),
  createdAt: integer("created_at").notNull(),
});

export const chatToolCalls = sqliteTable("chat_tool_calls", {
  id: text("id").primaryKey(),
  threadId: text("thread_id").notNull(),
  messageId: text("message_id").notNull(),
  name: text("name").notNull(),
  status: text("status").notNull().default("pending"),
  siteId: text("site_id"),
  inputJson: text("input_json").notNull().default("{}"),
  outputJson: text("output_json").notNull().default("{}"),
  creditType: text("credit_type"),
  creditCost: integer("credit_cost"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const appSettings = sqliteTable("app_settings", {
  key: text("key").primaryKey(),
  valueJson: text("value_json").notNull().default("{}"),
  updatedAt: integer("updated_at").notNull(),
});

export const agentRuntimeRuns = sqliteTable("agent_runtime_runs", {
  id: text("id").primaryKey(),
  threadId: text("thread_id"),
  siteId: text("site_id"),
  status: text("status").notNull().default("queued"),
  mode: text("mode").notNull().default("local"),
  inputJson: text("input_json").notNull().default("{}"),
  stateJson: text("state_json").notNull().default("{}"),
  pendingApprovalJson: text("pending_approval_json").notNull().default("{}"),
  resultJson: text("result_json").notNull().default("{}"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const agentRuntimeEvents = sqliteTable("agent_runtime_events", {
  id: text("id").primaryKey(),
  agentRunId: text("agent_run_id").notNull(),
  type: text("type").notNull(),
  message: text("message").notNull().default(""),
  dataJson: text("data_json").notNull().default("{}"),
  createdAt: integer("created_at").notNull(),
});
