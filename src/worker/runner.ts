import path from "node:path";
import {
  appendRunEvent,
  createContentItem,
  getRun,
  getSite,
  updateRunStatus,
} from "@/db/repository";
import { getLocalAgentSettings } from "@/db/repositories/settings";
import { browserProfilesRoot } from "@/lib/paths";
import { fetchArticleText, generateTopicPost, rewriteArticle, searchGoogleNews } from "@/lib/scraper";
import { postNextThreadsContent, type ThreadsPostMode } from "@/lib/threads";
import type { AutomationContext, RunRecord } from "@/lib/types";

function stringParam(params: Record<string, unknown>, key: string, fallback = "") {
  const value = params[key];
  return typeof value === "string" ? value : fallback;
}

function booleanParam(params: Record<string, unknown>, key: string, fallback = false) {
  const value = params[key];
  return typeof value === "boolean" ? value : fallback;
}

function numberParam(params: Record<string, unknown>, key: string, fallback: number) {
  const value = params[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function urlList(params: Record<string, unknown>) {
  const raw = params.urls ?? params.url;
  if (Array.isArray(raw)) {
    return raw.filter((item): item is string => typeof item === "string" && /^https?:\/\//.test(item));
  }
  if (typeof raw === "string") {
    return raw
      .split(/[\r\n,]+/)
      .map((item) => item.trim())
      .filter((item) => /^https?:\/\//.test(item));
  }
  return [];
}

async function makeContext(run: RunRecord): Promise<AutomationContext> {
  const site = run.siteId ? await getSite(run.siteId) : undefined;
  return {
    runId: run.id,
    site: site ?? undefined,
    params: run.params,
    profilePath: site?.profilePath ?? path.join(browserProfilesRoot(), "default"),
    log: async (message, level = "info") => {
      await appendRunEvent(run.id, message, level);
    },
    checkStop: async () => {
      const latest = await getRun(run.id);
      return latest?.status === "cancelled";
    },
  };
}

async function runTopicGenerator(run: RunRecord, ctx: AutomationContext) {
  const topic = stringParam(run.params, "topic") || stringParam(run.params, "prompt");
  if (!topic) {
    throw new Error("Missing topic");
  }
  await ctx.log(`開始 AI 生文：${topic}`);
  const generated = await generateTopicPost({
    topic,
    keywords: stringParam(run.params, "keywords"),
    maxWords: numberParam(run.params, "maxWords", 300),
    language: stringParam(run.params, "language", "繁體中文"),
    prompt: stringParam(run.params, "prompt"),
  });
  const item = await createContentItem({
    title: generated.title,
    body: generated.body,
    postReadyText: generated.postReadyText,
    sourceUrls: [],
    status: "ready",
  });
  await ctx.log(`已建立素材：${item.title} (${generated.provider}/${generated.model})`, "success");
  return `Created content item ${item.id}`;
}

async function runUrlImporter(run: RunRecord, ctx: AutomationContext) {
  const urls = urlList(run.params);
  if (urls.length === 0) {
    throw new Error("Missing URL");
  }

  let count = 0;
  for (const url of urls) {
    await ctx.log(`抓取 URL：${url}`);
    const article = await fetchArticleText(url);
    const rewrite = booleanParam(run.params, "rewrite", true);
    const content = rewrite
      ? await rewriteArticle({
          title: article.title || url,
          text: article.text,
          maxWords: numberParam(run.params, "maxWords", 300),
          language: stringParam(run.params, "language", "繁體中文"),
          prompt: stringParam(run.params, "prompt"),
        })
      : {
          title: article.title || url,
          body: article.text.slice(0, numberParam(run.params, "maxWords", 300) * 2),
          postReadyText: article.text.slice(0, numberParam(run.params, "maxWords", 300) * 2),
        };
    await createContentItem({
      title: content.title,
      body: content.body,
      postReadyText: content.postReadyText,
      sourceUrls: [url],
      imagePath: article.imageUrl,
      status: "ready",
    });
    count += 1;
  }
  await ctx.log(`URL 匯入完成：${count} 篇`, "success");
  return `Imported ${count} URL(s)`;
}

async function runTopicSearch(run: RunRecord, ctx: AutomationContext) {
  const topic = stringParam(run.params, "topic");
  if (!topic) {
    throw new Error("Missing topic");
  }
  const maxItems = numberParam(run.params, "articleCount", 3);
  const news = await searchGoogleNews(topic, maxItems);
  if (news.length === 0) {
    throw new Error("No Google News RSS result");
  }
  await ctx.log(`Google News 找到 ${news.length} 篇，開始整理。`);

  const sourceText = news
    .map((item, index) => `${index + 1}. ${item.title}\n${item.description}\n${item.link}`)
    .join("\n\n");
  const generated = await generateTopicPost({
    topic,
    keywords: stringParam(run.params, "keywords"),
    maxWords: numberParam(run.params, "maxWords", 300),
    language: stringParam(run.params, "language", "繁體中文"),
    prompt: `${stringParam(run.params, "prompt")}\n\n請根據以下新聞摘要整理：\n${sourceText}`,
  });
  const item = await createContentItem({
    title: generated.title,
    body: generated.body,
    postReadyText: generated.postReadyText,
    sourceUrls: news.map((item) => item.link).filter(Boolean),
    status: "ready",
  });
  await ctx.log(`已建立新聞素材：${item.title}`, "success");
  return `Created news content item ${item.id}`;
}

async function runThreads(run: RunRecord, ctx: AutomationContext) {
  if (!ctx.site) {
    throw new Error("Threads run requires siteId");
  }
  const settings = await getLocalAgentSettings();
  const result = await postNextThreadsContent({
    site: ctx.site,
    ctx,
    allowNoImage: booleanParam(run.params, "allowNoImage", true),
    appendText: stringParam(run.params, "appendText"),
    postMode: stringParam(run.params, "postMode", "title_body") as ThreadsPostMode,
    confirmLivePost: booleanParam(run.params, "scheduledPublishAuthorized", false)
      || booleanParam(run.params, "confirmLivePost", false)
      || settings.agentPermissions.browserPostContent === "auto",
    contentItemId: stringParam(run.params, "contentItemId"),
  });
  if (!result.ok) {
    throw new Error(result.message);
  }
  return result.message;
}

async function runComposePost(run: RunRecord, ctx: AutomationContext) {
  const composeText = stringParam(run.params, "composeText");
  if (composeText) {
    const item = await createContentItem({
      title: composeText.split("\n")[0]?.slice(0, 80) || "Threads draft",
      body: composeText,
      postReadyText: composeText,
      sourceUrls: [],
      imagePath: stringParam(run.params, "composeImage"),
      status: "ready",
    });
    await ctx.log(`已儲存草稿素材：${item.id}`, "success");
    return `Saved compose draft ${item.id}`;
  }
  return runThreads(run, ctx);
}

export async function processRun(run: RunRecord) {
  const ctx = await makeContext(run);
  try {
    await ctx.log(`開始執行 ${run.playbookId}`);
    let message: string;
    switch (run.playbookId) {
      case "topic_article_generator":
      case "ai_prompt_proxy":
        message = await runTopicGenerator(run, ctx);
        break;
      case "article_scraper_rewriter":
      case "ai_url_extractor":
        message = await runUrlImporter(run, ctx);
        break;
      case "topic_search_writer":
        message = await runTopicSearch(run, ctx);
        break;
      case "threads_auto_post":
        message = await runThreads(run, ctx);
        break;
      case "threads_compose_post":
        message = await runComposePost(run, ctx);
        break;
      default:
        throw new Error(`Unsupported playbook: ${run.playbookId}`);
    }
    const status = message.toLowerCase().includes("dry run") ? "warning" : "success";
    await updateRunStatus(run.id, status, message);
    await ctx.log(`完成：${message}`, status === "warning" ? "warn" : "success");
  } catch (error) {
    const message = (error as Error).message;
    await ctx.log(message, "error");
    await updateRunStatus(run.id, "failed", message);
  }
}
