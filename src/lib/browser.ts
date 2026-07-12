import type { BrowserContext, Page } from "playwright-core";

const DEFAULT_VIEWPORT = { width: 1280, height: 900 };

async function loadPlaywrightChromium() {
  const playwright = await import("playwright") as unknown as {
    chromium?: {
      launchPersistentContext(profilePath: string, options: Record<string, unknown>): Promise<BrowserContext>;
    };
    default?: {
      chromium?: {
        launchPersistentContext(profilePath: string, options: Record<string, unknown>): Promise<BrowserContext>;
      };
    };
  };
  const chromium = playwright.chromium ?? playwright.default?.chromium;
  if (!chromium) {
    throw new Error("playwright chromium launcher is not available");
  }
  return chromium;
}

export async function launchSiteProfileContext(profilePath: string) {
  const chromium = await loadPlaywrightChromium();
  return await chromium.launchPersistentContext(profilePath, {
    headless: false,
    viewport: DEFAULT_VIEWPORT,
  }) as unknown as BrowserContext;
}

export async function firstPage(context: BrowserContext): Promise<Page> {
  return context.pages()[0] ?? (await context.newPage());
}

export async function sleep(ms: number) {
  await new Promise<void>((resolve) => setTimeout(resolve, ms));
}
