import { listContentItems, reconcileContentImagesFromChatHistory } from "@/db/repository";
import { ok } from "@/lib/api";
import { parseContentFilter } from "@/lib/content-filter";

export const runtime = "nodejs";

export async function GET(request: Request) {
  await reconcileContentImagesFromChatHistory();
  return ok(await listContentItems(parseContentFilter(request.url)));
}
