import { getBrowserPreviewFrame } from "@/lib/browser-preview";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await context.params;
  const frame = getBrowserPreviewFrame(siteId);

  if (!frame) {
    return new Response("Preview frame not ready", { status: 404 });
  }

  return new Response(Uint8Array.from(frame), {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}