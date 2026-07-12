import { createAgentChatThread, listAgentChatThreads } from "@/db/repository";
import { fail, ok } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const rawLimit = Number(new URL(request.url).searchParams.get("limit") || 0);
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(Math.floor(rawLimit), 200) : undefined;
    return ok(await listAgentChatThreads({ limit }));
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Failed to list chat threads", 500);
  }
}

export async function POST() {
  try {
    const thread = await createAgentChatThread();
    return ok({ thread, messages: [] }, { status: 201 });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Failed to create chat thread", 500);
  }
}
