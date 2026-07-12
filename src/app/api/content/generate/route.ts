import { createContentItem } from "@/db/repository";
import { fail, ok, parseJson } from "@/lib/api";
import { generateTopicPost } from "@/lib/scraper";
import { contentGenerateSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const parsed = await parseJson(request, contentGenerateSchema);
  if (parsed.error) {
    return fail("Invalid generation payload", 400, parsed.error);
  }
  const generated = await generateTopicPost(parsed.data);
  const item = await createContentItem({
    title: generated.title,
    body: generated.body,
    postReadyText: generated.postReadyText,
    sourceUrls: [],
    metadata: {
      provider: generated.provider,
      model: generated.model,
      prompt: parsed.data.prompt,
      topic: parsed.data.topic,
      generationType: "topic",
    },
    status: "ready",
  });
  return ok({ item, provider: generated.provider, model: generated.model }, { status: 201 });
}
