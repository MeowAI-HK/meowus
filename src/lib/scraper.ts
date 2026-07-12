import * as cheerio from "cheerio";
import { XMLParser } from "fast-xml-parser";
import { generateStructured, MissingAIKeyError, postDraftSchema } from "./ai";
import { normalizePostText } from "./post-format";

export async function fetchArticleText(url: string) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
      Accept: "text/html,application/xhtml+xml",
    },
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const html = await response.text();
  const $ = cheerio.load(html);
  $("script,style,nav,header,footer,aside,form,iframe").remove();
  const title =
    $("meta[property='og:title']").attr("content")?.trim() ||
    $("title").first().text().trim() ||
    $("h1").first().text().trim();
  const imageUrl = $("meta[property='og:image']").attr("content")?.trim() || "";
  const text = normalizePostText($("article").text().trim() || $("main").text().trim() || $("body").text().trim());
  return { title, text: text.slice(0, 12_000), imageUrl };
}

function toPostDraft(draft: { title: string; body: string }, fallbackTitle: string) {
  const title = normalizePostText(draft.title) || fallbackTitle;
  const body = normalizePostText(draft.body);
  return {
    title,
    body,
    postReadyText: normalizePostText(title && body && body !== title ? `${title}\n\n${body}` : body || title),
  };
}

export async function rewriteArticle(input: {
  title: string;
  text: string;
  maxWords?: number;
  language?: string;
  prompt?: string;
}) {
  const language = input.language ?? "Traditional Chinese";
  const maxWords = input.maxWords ?? 300;
  const prompt = [
    `Rewrite the article into a ready-to-post social media draft in ${language}.`,
    `Keep the body to roughly ${maxWords} words.`,
    "title: a short, catchy headline. body: the post copy a reader can publish as-is.",
    input.prompt ? `Additional requirements: ${input.prompt}` : "",
    "",
    `Article title: ${input.title}`,
    `Article text: ${input.text.slice(0, 7000)}`,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const result = await generateStructured({ prompt, schema: postDraftSchema });
    return { ...toPostDraft(result.data, input.title), provider: result.provider, model: result.model };
  } catch (error) {
    if (error instanceof MissingAIKeyError) {
      throw error;
    }
    throw new Error(`AI rewrite failed: ${(error as Error).message}`);
  }
}

export async function generateTopicPost(input: {
  topic: string;
  keywords?: string;
  maxWords?: number;
  language?: string;
  prompt?: string;
  systemPrompt?: string;
}) {
  const prompt = [
    `Write a ready-to-post Threads social media draft in ${input.language ?? "Traditional Chinese"}.`,
    `Topic: ${input.topic}`,
    `Keep the body to roughly ${input.maxWords ?? 300} words.`,
    "title: a short, catchy headline. body: the post copy a reader can publish as-is.",
    input.keywords ? `Include these keywords naturally: ${input.keywords}` : "",
    input.prompt ? `Additional requirements: ${input.prompt}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  const result = await generateStructured({ prompt, schema: postDraftSchema, systemPrompt: input.systemPrompt });
  return { ...toPostDraft(result.data, input.topic), provider: result.provider, model: result.model };
}

export async function searchGoogleNews(topic: string, maxItems = 5) {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(topic)}&hl=zh-HK&gl=HK&ceid=HK:zh-Hant`;
  const response = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 Chrome/120 Safari/537.36" },
  });
  if (!response.ok) {
    throw new Error(`Google News RSS HTTP ${response.status}`);
  }
  const xml = await response.text();
  const parser = new XMLParser();
  const data = parser.parse(xml);
  const items = data?.rss?.channel?.item;
  const normalized = Array.isArray(items) ? items : items ? [items] : [];
  return normalized.slice(0, maxItems).map((item) => ({
    title: String(item.title ?? ""),
    link: String(item.link ?? ""),
    pubDate: String(item.pubDate ?? ""),
    description: String(item.description ?? ""),
  }));
}
