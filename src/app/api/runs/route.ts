import { createRun, listRuns } from "@/db/repository";
import { fail, ok, parseJson } from "@/lib/api";
import { runInputSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const rawLimit = Number(new URL(request.url).searchParams.get("limit") || 50);
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(Math.floor(rawLimit), 200) : 50;
  return ok(await listRuns(limit));
}

export async function POST(request: Request) {
  const parsed = await parseJson(request, runInputSchema);
  if (parsed.error) {
    return fail("Invalid run payload", 400, parsed.error);
  }
  if (
    parsed.data.playbookId === "threads_auto_post" &&
    parsed.data.params.confirmLivePost === true &&
    parsed.data.params.frontendPublishApproved !== true
  ) {
    return fail("Live publish requires frontend confirmation.", 400);
  }
  const run = await createRun(parsed.data);
  return ok(run, { status: 201 });
}
