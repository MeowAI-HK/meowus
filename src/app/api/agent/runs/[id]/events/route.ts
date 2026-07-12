import { listAgentRuntimeEvents } from "@/db/repository";
import { ok } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const url = new URL(request.url);
  const stream = url.searchParams.get("stream") === "1";
  const after = Number(url.searchParams.get("after") ?? 0);

  if (!stream) {
    return ok(await listAgentRuntimeEvents(id, after));
  }

  const encoder = new TextEncoder();
  let cursor = after;
  const body = new ReadableStream({
    async start(controller) {
      const timer = setInterval(async () => {
        const events = await listAgentRuntimeEvents(id, cursor);
        for (const event of events) {
          cursor = Math.max(cursor, event.createdAt);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        }
      }, 1000);

      setTimeout(() => {
        clearInterval(timer);
        controller.close();
      }, 60_000);
    },
  });

  return new Response(body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
