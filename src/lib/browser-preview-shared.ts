import type { BrowserContext, Page } from "playwright-core";

export const PREVIEW_SIZE = { width: 960, height: 720 };
export const DEFAULT_SITE_URL = "https://www.threads.net/";
const BLANK_URL_PREFIXES = ["about:blank", "chrome://newtab", "chrome://", "devtools://"];

export type PreviewStatus = "starting" | "ready" | "error" | "closed";

export type StartBrowserPreviewOptions = {
  bringToFront?: boolean;
};

export type BrowserPreviewSession = {
  siteId: string;
  siteName: string;
  profilePath: string;
  status: PreviewStatus;
  error?: string;
  pageUrl?: string;
  startedAt: number;
  updatedAt: number;
  lastFrameAt?: number;
  frame?: Buffer;
  context?: BrowserContext;
  page?: Page;
  streamingPage?: Page;
  contextBound: boolean;
  boundPages: WeakSet<Page>;
};

export type BrowserPreviewSnapshot = {
  siteId: string;
  siteName: string;
  profilePath: string;
  status: PreviewStatus | "idle";
  error?: string;
  pageUrl?: string;
  startedAt?: number;
  updatedAt?: number;
  lastFrameAt?: number;
  hasFrame: boolean;
};

export type BrowserPreviewStore = {
  sessions: Map<string, BrowserPreviewSession>;
  starting: Map<string, Promise<BrowserPreviewSnapshot>>;
  cleanupRegistered: boolean;
  cleanupPromise?: Promise<void>;
};

export function now() {
  return Date.now();
}

export function touch(session: BrowserPreviewSession) {
  session.updatedAt = now();
}

export function isBlankBrowserUrl(url: string) {
  return !url || BLANK_URL_PREFIXES.some((prefix) => url.startsWith(prefix));
}

export function getOpenPages(context: BrowserContext) {
  return context.pages().filter((page) => !page.isClosed());
}

export function latestNonBlankPage(pages: Page[]) {
  for (let index = pages.length - 1; index >= 0; index -= 1) {
    const page = pages[index];
    if (!isBlankBrowserUrl(page.url())) {
      return page;
    }
  }
  return undefined;
}

export function normalizePreviewError(error: unknown) {
  const message = error instanceof Error ? error.message : "Failed to start browser preview";

  if (
    /existing browser session/i.test(message)
    || /profile.*in use/i.test(message)
    || message.includes("Target page, context or browser has been closed")
  ) {
    return "Browser profile is already in use or the browser was closed. Close the existing Chrome window and try again.";
  }

  return message;
}

export function applySessionError(session: BrowserPreviewSession, error: unknown) {
  session.status = "error";
  session.error = normalizePreviewError(error);
  touch(session);
}

export function toSnapshot(session?: BrowserPreviewSession): BrowserPreviewSnapshot {
  if (!session) {
    return {
      siteId: "",
      siteName: "",
      profilePath: "",
      status: "idle",
      hasFrame: false,
    };
  }

  return {
    siteId: session.siteId,
    siteName: session.siteName,
    profilePath: session.profilePath,
    status: session.status,
    error: session.error,
    pageUrl: session.pageUrl,
    startedAt: session.startedAt,
    updatedAt: session.updatedAt,
    lastFrameAt: session.lastFrameAt,
    hasFrame: Boolean(session.frame),
  };
}

export function markClosed(session: BrowserPreviewSession) {
  session.status = "closed";
  session.context = undefined;
  session.page = undefined;
  session.streamingPage = undefined;
  touch(session);
}
