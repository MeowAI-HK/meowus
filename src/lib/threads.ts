import path from "node:path";
import type { Page } from "playwright-core";
import { findNextReadyContentItem, getContentItem, markContentItemPosted } from "@/db/repository";
import { artifactsRoot } from "./paths";
import { truncateThreadsPost } from "./post-format";
import type { AutomationContext, ContentItem, SiteRecord } from "./types";
import { firstPage, launchSiteProfileContext, sleep } from "./browser";

export type ThreadsPostMode = "title" | "body" | "title_body";

async function clickFirst(page: Page, selectors: string[]) {
  for (const selector of selectors) {
    const locator = page.locator(selector);
    const count = await locator.count();
    for (let index = 0; index < count; index += 1) {
      const candidate = locator.nth(index);
      if (await candidate.isVisible().catch(() => false)) {
        await candidate.click({ timeout: 5_000 });
        return true;
      }
    }
  }
  return false;
}

async function bodyText(page: Page) {
  return page.locator("body").innerText({ timeout: 10_000 }).catch(() => "");
}

function looksLoggedOut(text: string) {
  return /continue with instagram|log in|sign up to post|log in to see|登入|使用 instagram 帳號/i.test(text);
}

function selectSourceText(item: ContentItem, mode: ThreadsPostMode) {
  if (mode === "title") return item.title;
  if (mode === "body") return item.body;
  return item.title && item.body ? `${item.title}\n\n${item.body}` : item.postReadyText;
}

export async function postNextThreadsContent(input: {
  site: SiteRecord;
  ctx: AutomationContext;
  allowNoImage?: boolean;
  appendText?: string;
  postMode?: ThreadsPostMode;
  confirmLivePost?: boolean;
  contentItemId?: string;
}) {
  const item = input.contentItemId
    ? await getContentItem(input.contentItemId)
    : await findNextReadyContentItem();
  if (!item) {
    await input.ctx.log("No ready content item to post", "warn");
    return { ok: false, message: "No ready content item" };
  }
  if (input.contentItemId && item.status !== "ready") {
    return { ok: false, message: `Scheduled content is ${item.status}, not ready` };
  }

  const imagePath = item.imagePath ?? "";
  if (!imagePath && !input.allowNoImage) {
    await input.ctx.log(`Content "${item.title}" has no image; skipping because images are required.`, "warn");
    return { ok: false, message: "Content item has no image" };
  }

  const postText = truncateThreadsPost(selectSourceText(item, input.postMode ?? "title_body"), input.appendText);
  await input.ctx.log(`Selected content: ${item.title || item.id}`);
  const browserContext = await launchSiteProfileContext(input.ctx.profilePath);

  try {
    const page = await firstPage(browserContext);
    await page.goto("https://www.threads.net/", { waitUntil: "domcontentloaded", timeout: 45_000 });
    await sleep(2_000);

    if (looksLoggedOut(await bodyText(page))) {
      await input.ctx.log("Threads profile needs login. Open the site browser profile and complete Threads login first.", "warn");
      return { ok: false, message: "Threads profile needs login" };
    }

    const openedComposer = await clickFirst(page, [
      "[aria-label='New thread']",
      "[aria-label='Create']",
      "div[role='button']:has-text('New thread')",
      "div[role='button']:has-text('Create')",
      "text=/^New thread$/i",
      "text=/^Create$/i",
    ]);
    if (!openedComposer) {
      if (looksLoggedOut(await bodyText(page))) {
        return { ok: false, message: "Threads profile needs login" };
      }
      return { ok: false, message: "Threads composer button not found" };
    }

    const editor = page.locator("[contenteditable='true'], textarea").first();
    await editor.click({ timeout: 15_000 });
    await editor.fill(postText);

    if (imagePath) {
      const fileInput = page.locator("input[type='file']").first();
      if ((await fileInput.count()) > 0) {
        await fileInput.setInputFiles(imagePath);
      } else {
        await input.ctx.log("Image upload input was not found; continuing with text only.", "warn");
      }
    }

    const artifactPath = path.join(artifactsRoot(), `${input.ctx.runId}-threads-draft.png`);
    await page.screenshot({ path: artifactPath, fullPage: true });

    if (!input.confirmLivePost) {
      await input.ctx.log("Dry run completed before final publish.", "warn");
      return { ok: true, message: "Dry run completed before posting", artifactPath };
    }

    const posted = await clickFirst(page, [
      "[aria-label='Post']",
      "div[role='button']:has-text('Post')",
      "text=/^Post$/i",
    ]);
    if (!posted) {
      return { ok: false, message: "Post button not found", artifactPath };
    }

    await sleep(4_000);
    await markContentItemPosted(item.id);
    await input.ctx.log("Threads post completed and content item was marked as posted.", "success");
    return { ok: true, message: "Posted", artifactPath };
  } finally {
    await browserContext.close();
  }
}
