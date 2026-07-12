import fs from "node:fs/promises";
import path from "node:path";
import { browserProfilesRoot } from "@/lib/paths";

type Page = {
  url(): string;
  goto(url: string, options?: Record<string, unknown>): Promise<unknown>;
  title(): Promise<string>;
  isClosed(): boolean;
  locator(selector: string): {
    first(): {
      click(options?: Record<string, unknown>): Promise<unknown>;
      fill(text: string, options?: Record<string, unknown>): Promise<unknown>;
      type(text: string, options?: Record<string, unknown>): Promise<unknown>;
    };
    innerText(options?: Record<string, unknown>): Promise<string>;
  };
  screenshot(options: Record<string, unknown>): Promise<unknown>;
};

type BrowserContext = {
  close(): Promise<void>;
  pages(): Page[];
  newPage(): Promise<Page>;
  on(event: "close", handler: () => void): void;
};

type Session = {
  profileKey: string;
  profilePath: string;
  context: BrowserContext;
  page: Page;
  updatedAt: number;
};

const DEFAULT_VIEWPORT = { width: 1280, height: 900 };

export class PlaywrightSessionManager {
  private readonly sessions = new Map<string, Session>();

  async getPage(input: { profileKey?: string; profilePath?: string; startUrl?: string }) {
    const profileKey = input.profileKey || "default";
    const profilePath = input.profilePath || path.join(/*turbopackIgnore: true*/ browserProfilesRoot(), profileKey);
    const existing = this.sessions.get(profileKey);
    if (existing && !existing.page.isClosed()) {
      existing.updatedAt = Date.now();
      return existing;
    }

    if (existing) {
      await existing.context.close().catch(() => undefined);
      this.sessions.delete(profileKey);
    }

    await fs.mkdir(profilePath, { recursive: true });
    const { chromium } = (await import("playwright")) as {
      chromium: {
        launchPersistentContext(profilePath: string, options: Record<string, unknown>): Promise<BrowserContext>;
      };
    };
    const context = await chromium.launchPersistentContext(profilePath, {
      headless: false,
      viewport: DEFAULT_VIEWPORT,
    });
    const page = context.pages()[0] ?? (await context.newPage());
    if (input.startUrl && /^https?:\/\//i.test(input.startUrl) && page.url() === "about:blank") {
      await page.goto(input.startUrl, { waitUntil: "domcontentloaded", timeout: 45_000 });
    }
    const session = { profileKey, profilePath, context, page, updatedAt: Date.now() };
    this.sessions.set(profileKey, session);
    context.on("close", () => this.sessions.delete(profileKey));
    return session;
  }

  async close(profileKey: string) {
    const session = this.sessions.get(profileKey);
    if (!session) return false;
    await session.context.close().catch(() => undefined);
    this.sessions.delete(profileKey);
    return true;
  }
}

export const playwrightSessionManager = new PlaywrightSessionManager();
