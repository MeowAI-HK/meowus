import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { mkdirSync } from "node:fs";
import path from "node:path";
import * as schema from "./schema";
import { dataRoot, normalizeFileUrl } from "@/lib/paths";

function resolveDatabaseUrl() {
  const configured = process.env.SOCIAL_AUTO_POST_DB_URL?.trim();
  const defaultUrl = `file:${path.join(dataRoot(), "social-auto-post.db")}`;

  if (!configured) {
    return normalizeFileUrl(defaultUrl);
  }

  // Standalone Electron bundles still load `.env.local`; relative file URLs there
  // would incorrectly resolve inside `.next/standalone`. Route those back to the
  // selected runtime data directory instead.
  if (
    process.env.SMEPOST_ELECTRON === "1" &&
    /^file:(?!\/|[A-Za-z]:[\\/])/.test(configured)
  ) {
    return normalizeFileUrl(defaultUrl);
  }

  return normalizeFileUrl(configured);
}

const dbUrl = resolveDatabaseUrl();

if (dbUrl.startsWith("file:")) {
  const filePath = dbUrl.slice("file:".length);
  mkdirSync(path.dirname(filePath), { recursive: true });
} else {
  dataRoot();
}

export const sqlite = createClient({ url: dbUrl });
export const db = drizzle(sqlite, { schema });

let initialized: Promise<void> | null = null;

export function ensureDatabase() {
  initialized ??= initializeDatabase();
  return initialized;
}

async function initializeDatabase() {
  const statements = [
    `CREATE TABLE IF NOT EXISTS sites (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      platform TEXT NOT NULL,
      url TEXT NOT NULL DEFAULT '',
      account TEXT NOT NULL DEFAULT '',
      profile_path TEXT NOT NULL DEFAULT '',
      memo TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'needs_login',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS ai_providers (
      id TEXT PRIMARY KEY,
      provider TEXT NOT NULL,
      model TEXT NOT NULL,
      base_url TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'unknown',
      disabled INTEGER NOT NULL DEFAULT 0,
      key_count INTEGER NOT NULL DEFAULT 0,
      last_check_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS content_items (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL DEFAULT '',
      body TEXT NOT NULL DEFAULT '',
      post_ready_text TEXT NOT NULL DEFAULT '',
      source_urls_json TEXT NOT NULL DEFAULT '[]',
      image_path TEXT NOT NULL DEFAULT '',
      metadata_json TEXT NOT NULL DEFAULT '{}',
      status TEXT NOT NULL DEFAULT 'draft',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS schedules (
      id TEXT PRIMARY KEY,
      playbook_id TEXT NOT NULL,
      site_id TEXT,
      enabled INTEGER NOT NULL DEFAULT 1,
      schedule_times_json TEXT NOT NULL DEFAULT '[]',
      params_json TEXT NOT NULL DEFAULT '{}',
      status TEXT NOT NULL DEFAULT 'scheduled',
      content_item_id TEXT,
      publish_authorized INTEGER NOT NULL DEFAULT 0,
      last_run_at INTEGER,
      next_run_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS runs (
      id TEXT PRIMARY KEY,
      playbook_id TEXT NOT NULL,
      site_id TEXT,
      schedule_id TEXT,
      scheduled_for INTEGER,
      status TEXT NOT NULL DEFAULT 'queued',
      params_json TEXT NOT NULL DEFAULT '{}',
      result_message TEXT NOT NULL DEFAULT '',
      artifact_path TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL,
      started_at INTEGER,
      finished_at INTEGER,
      updated_at INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS run_events (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL,
      level TEXT NOT NULL DEFAULT 'info',
      message TEXT NOT NULL,
      data_json TEXT NOT NULL DEFAULT '{}',
      created_at INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS chat_threads (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL DEFAULT '',
      active_site_id TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY,
      thread_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      site_id TEXT,
      mode TEXT,
      metadata_json TEXT NOT NULL DEFAULT '{}',
      created_at INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS chat_tool_calls (
      id TEXT PRIMARY KEY,
      thread_id TEXT NOT NULL,
      message_id TEXT NOT NULL,
      name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      site_id TEXT,
      input_json TEXT NOT NULL DEFAULT '{}',
      output_json TEXT NOT NULL DEFAULT '{}',
      credit_type TEXT,
      credit_cost INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value_json TEXT NOT NULL DEFAULT '{}',
      updated_at INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS agent_runtime_runs (
      id TEXT PRIMARY KEY,
      thread_id TEXT,
      site_id TEXT,
      status TEXT NOT NULL DEFAULT 'queued',
      mode TEXT NOT NULL DEFAULT 'local',
      input_json TEXT NOT NULL DEFAULT '{}',
      state_json TEXT NOT NULL DEFAULT '{}',
      pending_approval_json TEXT NOT NULL DEFAULT '{}',
      result_json TEXT NOT NULL DEFAULT '{}',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS agent_runtime_events (
      id TEXT PRIMARY KEY,
      agent_run_id TEXT NOT NULL,
      type TEXT NOT NULL,
      message TEXT NOT NULL DEFAULT '',
      data_json TEXT NOT NULL DEFAULT '{}',
      created_at INTEGER NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS idx_runs_status_created ON runs(status, created_at)`,
    `CREATE INDEX IF NOT EXISTS idx_run_events_run_created ON run_events(run_id, created_at)`,
    `CREATE INDEX IF NOT EXISTS idx_schedules_enabled_next ON schedules(enabled, next_run_at)`,
    `CREATE INDEX IF NOT EXISTS idx_chat_messages_thread_created ON chat_messages(thread_id, created_at)`,
    `CREATE INDEX IF NOT EXISTS idx_chat_tool_calls_message_created ON chat_tool_calls(message_id, created_at)`,
    `CREATE INDEX IF NOT EXISTS idx_agent_runtime_runs_status_created ON agent_runtime_runs(status, created_at)`,
    `CREATE INDEX IF NOT EXISTS idx_agent_runtime_events_run_created ON agent_runtime_events(agent_run_id, created_at)`,
  ];

  for (const statement of statements) {
    await sqlite.execute(statement);
  }

  await sqlite.execute(`ALTER TABLE content_items ADD COLUMN metadata_json TEXT NOT NULL DEFAULT '{}'`).catch(() => undefined);
  await sqlite.execute(`ALTER TABLE schedules ADD COLUMN status TEXT NOT NULL DEFAULT 'scheduled'`).catch(() => undefined);
  await sqlite.execute(`ALTER TABLE schedules ADD COLUMN content_item_id TEXT`).catch(() => undefined);
  await sqlite.execute(`ALTER TABLE schedules ADD COLUMN publish_authorized INTEGER NOT NULL DEFAULT 0`).catch(() => undefined);
  await sqlite.execute(`ALTER TABLE runs ADD COLUMN scheduled_for INTEGER`).catch(() => undefined);
  await sqlite.execute(`CREATE UNIQUE INDEX IF NOT EXISTS idx_runs_schedule_occurrence ON runs(schedule_id, scheduled_for)`).catch(() => undefined);
}
