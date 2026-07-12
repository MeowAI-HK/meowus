import { getSite } from "@/db/repository";
import { fail, ok } from "@/lib/api";
import { startBrowserPreviewSession } from "@/lib/browser-preview";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_request: Request, context: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await context.params;
  const site = await getSite(siteId);
  if (!site) {
    return fail("Site not found", 404);
  }

  const session = await startBrowserPreviewSession(site, { bringToFront: true });
  if (session.status === "error") {
    return fail(session.error || "Failed to open browser profile", 500, session);
  }

  return ok({
    launched: true,
    siteId,
    profilePath: site.profilePath,
    session,
  });
}
