import path from "node:path";
import type { BrowserContext, Page } from "playwright-core";
import { launchSiteProfileContext } from "./browser";
import {
  applySessionError,
  DEFAULT_SITE_URL,
  getOpenPages,
  isBlankBrowserUrl,
  latestNonBlankPage,
  markClosed,
  now,
  PREVIEW_SIZE,
  touch,
  toSnapshot,
  type BrowserPreviewSession,
  type StartBrowserPreviewOptions,
} from "./browser-preview-shared";
import {
  closeBrowserPreviewSessionContext,
  getBrowserPreviewStore,
} from "./browser-preview-store";
import { artifactsRoot } from "./paths";
import type { SiteRecord } from "./types";

async function closeSpareBlankPages(context: BrowserContext, activePage: Page) {
  const blankPages = getOpenPages(context).filter(
    (page) => page !== activePage && isBlankBrowserUrl(page.url()),
  );

  await Promise.all(blankPages.map((page) => page.close().catch(() => undefined)));
}

async function startStreaming(session: BrowserPreviewSession, page: Page) {
  if (session.streamingPage === page) {
    return;
  }

  const previousPage = session.streamingPage;
  session.streamingPage = page;

  if (previousPage && previousPage !== page && !previousPage.isClosed()) {
    await previousPage.screencast.stop().catch(() => undefined);
  }

  await page.screencast.start({
    size: PREVIEW_SIZE,
    onFrame: ({ data }) => {
      if (session.streamingPage !== page) {
        return;
      }

      session.frame = Buffer.from(data);
      session.lastFrameAt = now();
      session.page = page;
      session.pageUrl = page.url();
      touch(session);
    },
  });
}

async function pickSessionPage(session: BrowserPreviewSession) {
  const context = session.context;
  if (!context) {
    throw new Error("Browser preview session is missing context");
  }

  const currentPage = session.page && !session.page.isClosed() ? session.page : undefined;
  const pages = getOpenPages(context);

  return latestNonBlankPage(currentPage ? [currentPage, ...pages.filter((page) => page !== currentPage)] : pages)
    ?? currentPage
    ?? pages[pages.length - 1]
    ?? context.newPage();
}

async function activatePage(
  session: BrowserPreviewSession,
  page: Page,
  options: {
    siteUrl?: string;
    bringToFront?: boolean;
    closeBlankPages?: boolean;
  } = {},
) {
  if (page.isClosed()) {
    return;
  }

  if (options.siteUrl && isBlankBrowserUrl(page.url())) {
    await page.goto(options.siteUrl, {
      waitUntil: "domcontentloaded",
      timeout: 45_000,
    });
  }

  session.page = page;
  session.pageUrl = page.url();
  session.error = undefined;

  if (options.bringToFront !== false) {
    await page.bringToFront().catch(() => undefined);
  }

  await startStreaming(session, page);

  if (options.closeBlankPages !== false && session.context) {
    await closeSpareBlankPages(session.context, page);
  }

  session.status = "ready";
  touch(session);
}

function bindPageLifecycle(session: BrowserPreviewSession, page: Page, site: SiteRecord) {
  if (session.boundPages.has(page)) {
    return;
  }

  session.boundPages.add(page);

  const syncPageUrl = () => {
    if (session.page === page || session.streamingPage === page) {
      session.pageUrl = page.url();
      touch(session);
    }

    if (page !== session.page && !isBlankBrowserUrl(page.url())) {
      void activatePage(session, page, {
        bringToFront: false,
        closeBlankPages: false,
      }).catch((error) => applySessionError(session, error));
    }
  };

  page.on("framenavigated", syncPageUrl);
  page.on("load", syncPageUrl);
  page.on("close", () => {
    if (session.page !== page && session.streamingPage !== page) {
      return;
    }

    const context = session.context;
    if (!context) {
      markClosed(session);
      return;
    }

    const remainingPages = getOpenPages(context).filter((candidate) => candidate !== page);
    const nextPage = latestNonBlankPage(remainingPages) ?? remainingPages[remainingPages.length - 1];

    if (!nextPage) {
      markClosed(session);
      return;
    }

    void activatePage(session, nextPage, {
      siteUrl: site.url || DEFAULT_SITE_URL,
      bringToFront: false,
    }).catch((error) => applySessionError(session, error));
  });
}

function bindContextLifecycle(session: BrowserPreviewSession, context: BrowserContext, site: SiteRecord) {
  if (session.contextBound) {
    return;
  }

  session.contextBound = true;

  context.on("page", (page) => {
    bindPageLifecycle(session, page, site);

    if (!session.page || isBlankBrowserUrl(session.page.url())) {
      void activatePage(session, page, {
        siteUrl: site.url || DEFAULT_SITE_URL,
        bringToFront: false,
      }).catch((error) => applySessionError(session, error));
    }
  });

  context.on("close", () => {
    markClosed(session);
  });
}

async function bootPreviewSession(
  session: BrowserPreviewSession,
  site: SiteRecord,
  options: StartBrowserPreviewOptions,
) {
  const context = await launchSiteProfileContext(site.profilePath);

  session.context = context;
  bindContextLifecycle(session, context, site);

  const page = await pickSessionPage(session);
  bindPageLifecycle(session, page, site);
  await activatePage(session, page, {
    siteUrl: site.url || DEFAULT_SITE_URL,
    bringToFront: options.bringToFront ?? true,
  });
}

export function getBrowserPreviewSession(siteId: string) {
  return toSnapshot(getBrowserPreviewStore().sessions.get(siteId));
}

export function getBrowserPreviewFrame(siteId: string) {
  return getBrowserPreviewStore().sessions.get(siteId)?.frame ?? null;
}

export async function startBrowserPreviewSession(site: SiteRecord, options: StartBrowserPreviewOptions = {}) {
  const store = getBrowserPreviewStore();
  const existing = store.sessions.get(site.id);

  if (existing?.status === "ready" && existing.context) {
    try {
      const page = await pickSessionPage(existing);
      bindPageLifecycle(existing, page, site);
      await activatePage(existing, page, {
        siteUrl: site.url || DEFAULT_SITE_URL,
        bringToFront: options.bringToFront ?? true,
      });
      return toSnapshot(existing);
    } catch (error) {
      applySessionError(existing, error);
      return toSnapshot(existing);
    }
  }

  const inflight = store.starting.get(site.id);
  if (inflight) {
    return inflight;
  }

  if (existing) {
    await stopBrowserPreviewSession(site.id);
  }

  const session: BrowserPreviewSession = {
    siteId: site.id,
    siteName: site.name,
    profilePath: site.profilePath,
    status: "starting",
    startedAt: now(),
    updatedAt: now(),
    contextBound: false,
    boundPages: new WeakSet<Page>(),
  };

  store.sessions.set(site.id, session);

  const startup = bootPreviewSession(session, site, options)
    .then(() => toSnapshot(session))
    .catch(async (error) => {
      applySessionError(session, error);
      await session.context?.close().catch(() => undefined);
      return toSnapshot(session);
    })
    .finally(() => {
      store.starting.delete(site.id);
    });

  store.starting.set(site.id, startup);
  return startup;
}

export async function stopBrowserPreviewSession(siteId: string) {
  const store = getBrowserPreviewStore();
  const session = store.sessions.get(siteId);
  store.starting.delete(siteId);

  if (!session) {
    return false;
  }

  await closeBrowserPreviewSessionContext(session);
  store.sessions.delete(siteId);
  return true;
}

export type SiteBrowserToolName =
  | "browser_goto"
  | "browser_screenshot"
  | "browser_snapshot"
  | "browser_click"
  | "browser_type"
  | "browser_press"
  | "browser_tab_control"
  | "threads_create_post";

function requireString(value: unknown, label: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} is required`);
  }
  return value.trim();
}

async function firstVisibleLocator(page: Page, selectors: string[]) {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    if (await locator.isVisible({ timeout: 1200 }).catch(() => false)) {
      return locator;
    }
  }
  return null;
}

async function clickFirstVisible(page: Page, selectors: string[]) {
  const locator = await firstVisibleLocator(page, selectors);
  if (!locator) return false;
  await locator.click({ timeout: 10_000 }).catch(async (error) => {
    const message = error instanceof Error ? error.message : String(error);
    if (!/intercepts pointer events|not stable|not receiving pointer events/i.test(message)) {
      throw error;
    }
    await locator.click({ timeout: 10_000, force: true });
  });
  return true;
}

async function threadsLoginRequired(page: Page) {
  const bodyText = await page.locator("body").innerText({ timeout: 3_000 }).catch(() => "");
  return /log in|sign up|continue with instagram|login to see|登入|註冊 threads|使用 instagram 帳號繼續|改以用戶名稱登入/i.test(bodyText);
}

async function runThreadsCreatePost(page: Page, args: Record<string, unknown>) {
  const text = requireString(args.text, "text");
  const publish = args.publish === true;
  const imagePath = typeof args.imagePath === "string" ? args.imagePath.trim() : "";

  if (!/^https:\/\/(www\.)?threads\.(net|com)\//i.test(page.url())) {
    await page.goto("https://www.threads.com/", { waitUntil: "domcontentloaded", timeout: 45_000 });
  }

  const loginRequired = await threadsLoginRequired(page);
  if (loginRequired) {
    return { url: page.url(), drafted: false, published: false, loginRequired: true };
  }

  await clickFirstVisible(page, [
    '[aria-label="Create"]',
    '[aria-label="New thread"]',
    '[aria-label*="New thread"]',
    '[aria-label*="Create"]',
    'text="What\'s new?"',
    'text="Start a thread"',
    'text="新串文"',
    'text="發佈串文"',
    'text="發布串文"',
  ]);
  await page.waitForTimeout(1500);

  const composer = await firstVisibleLocator(page, [
    'div[contenteditable="true"][role="textbox"]',
    'div[contenteditable="true"]',
    'textarea',
    '[aria-label*="Start a thread"]',
    '[aria-label*="What\'s new"]',
    '[aria-label*="有什麼新鮮事"]',
  ]);
  if (!composer) {
    if (await threadsLoginRequired(page)) {
      return { url: page.url(), drafted: false, published: false, loginRequired: true };
    }
    throw new Error("Threads composer was not found. Open the logged-in Threads home page and try again.");
  }
  await composer.fill(text, { timeout: 15_000 }).catch(async () => {
    await composer.click({ timeout: 10_000 });
    await page.keyboard.insertText(text);
  });

  if (imagePath) {
    const fileInput = page.locator('input[type="file"]').first();
    if (await fileInput.count()) {
      await fileInput.setInputFiles(imagePath, { timeout: 15_000 });
      await page.waitForTimeout(8000);
    }
  }

  if (!publish) {
    return { url: page.url(), drafted: true, published: false, text };
  }

  const clickedPublish = await clickFirstVisible(page, [
    '[role="dialog"] div[role="button"]:has-text("Post")',
    '[role="dialog"] div[role="button"]:has-text("發佈")',
    '[role="dialog"] div[role="button"]:has-text("發布")',
    '[role="dialog"] button:has-text("Post")',
    '[role="dialog"] button:has-text("發佈")',
    '[role="dialog"] button:has-text("發布")',
    'div[role="button"]:has-text("Post")',
    'div[role="button"]:has-text("發佈")',
    'div[role="button"]:has-text("發布")',
    'button:has-text("Post")',
    'button:has-text("發佈")',
    'button:has-text("發布")',
  ]);
  if (!clickedPublish) {
    throw new Error("Threads publish button was not found after drafting the post.");
  }
  await page.waitForTimeout(5000);
  const composerStillVisible = await page
    .locator('div[contenteditable="true"][role="textbox"], div[contenteditable="true"], textarea')
    .first()
    .isVisible({ timeout: 1200 })
    .catch(() => false);
  if (composerStillVisible) {
    const clickedAgain = await clickFirstVisible(page, [
      '[role="dialog"] div[role="button"]:has-text("Post")',
      '[role="dialog"] div[role="button"]:has-text("發佈")',
      '[role="dialog"] div[role="button"]:has-text("發布")',
      '[role="dialog"] button:has-text("Post")',
      '[role="dialog"] button:has-text("發佈")',
      '[role="dialog"] button:has-text("發布")',
    ]);
    if (clickedAgain) {
      await page.waitForTimeout(5000);
    }
  }
  const stillDrafting = await page
    .locator('div[contenteditable="true"][role="textbox"], div[contenteditable="true"], textarea')
    .first()
    .isVisible({ timeout: 1200 })
    .catch(() => false);
  if (stillDrafting) {
    throw new Error("Threads post is still in the composer after clicking publish.");
  }
  return { url: page.url(), drafted: true, published: true, text };
}

async function getReadySitePage(site: SiteRecord, options: StartBrowserPreviewOptions = {}) {
  await startBrowserPreviewSession(site, options);
  const session = getBrowserPreviewStore().sessions.get(site.id);
  if (!session?.context) {
    throw new Error("Browser preview session is not available");
  }

  const page = await pickSessionPage(session);
  bindPageLifecycle(session, page, site);
  await activatePage(session, page, {
    siteUrl: site.url || DEFAULT_SITE_URL,
    bringToFront: options.bringToFront ?? true,
  });
  return { session, page };
}

async function summarizePage(page: Page, siteId: string) {
  const bodyText = await page
    .locator("body")
    .innerText({ timeout: 1500 })
    .catch(() => "");

  return {
    siteId,
    url: page.url(),
    title: await page.title().catch(() => ""),
    text: bodyText.slice(0, 4000),
    snapshot: getBrowserPreviewSession(siteId),
  };
}

export async function runSiteBrowserTool(
  site: SiteRecord,
  input: {
    name: SiteBrowserToolName;
    args?: Record<string, unknown>;
  },
) {
  const { session, page } = await getReadySitePage(site, { bringToFront: true });
  const args = input.args ?? {};

  if (input.name === "browser_goto") {
    const url = requireString(args.url, "url");
    if (!/^https?:\/\//i.test(url)) {
      throw new Error("browser_goto requires an http(s) URL");
    }
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });
  }

  if (input.name === "browser_screenshot") {
    const filePath = path.join(artifactsRoot(), `${site.id}-browser-${Date.now()}.png`);
    await page.screenshot({ path: filePath, fullPage: args.fullPage !== false });
    return { ...(await summarizePage(page, site.id)), path: filePath };
  }

  if (input.name === "browser_click") {
    const selector = requireString(args.selector, "selector");
    await page.locator(selector).first().click({ timeout: 15_000 });
  }

  if (input.name === "browser_type") {
    const selector = requireString(args.selector, "selector");
    const text = requireString(args.text, "text");
    const clear = args.clear !== false;
    const locator = page.locator(selector).first();
    if (clear) {
      await locator.fill(text, { timeout: 15_000 });
    } else {
      await locator.type(text, { timeout: 15_000 });
    }
  }

  if (input.name === "browser_press") {
    const key = requireString(args.key, "key");
    const selector = typeof args.selector === "string" ? args.selector.trim() : "";
    if (selector) {
      await page.locator(selector).first().press(key, { timeout: 15_000 });
    } else {
      await page.keyboard.press(key);
    }
  }

  if (input.name === "browser_tab_control") {
    const action = requireString(args.action, "action");
    if (action === "new") {
      const nextPage = await session.context!.newPage();
      bindPageLifecycle(session, nextPage, site);
      if (typeof args.url === "string" && /^https?:\/\//i.test(args.url)) {
        await nextPage.goto(args.url, { waitUntil: "domcontentloaded", timeout: 45_000 });
      }
      await activatePage(session, nextPage, { bringToFront: true, closeBlankPages: false });
      return summarizePage(nextPage, site.id);
    }

    if (action === "select") {
      const index = Number(args.index ?? 0);
      const pages = getOpenPages(session.context!);
      const nextPage = pages[index];
      if (!nextPage) {
        throw new Error("Browser tab not found");
      }
      await activatePage(session, nextPage, { bringToFront: true, closeBlankPages: false });
      return summarizePage(nextPage, site.id);
    }

    if (action === "close") {
      await page.close().catch(() => undefined);
      const nextPage = await pickSessionPage(session);
      await activatePage(session, nextPage, {
        siteUrl: site.url || DEFAULT_SITE_URL,
        bringToFront: true,
      });
      return summarizePage(nextPage, site.id);
    }

    throw new Error("Unsupported browser_tab_control action");
  }

  if (input.name === "threads_create_post") {
    const result = await runThreadsCreatePost(page, args);
    return { ...(await summarizePage(page, site.id)), ...result };
  }

  await page.bringToFront().catch(() => undefined);
  await startStreaming(session, page);
  session.page = page;
  session.pageUrl = page.url();
  touch(session);

  return summarizePage(page, site.id);
}
