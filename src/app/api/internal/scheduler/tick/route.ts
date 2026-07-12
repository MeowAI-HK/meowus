import { fail, ok } from "@/lib/api";
import { schedulerTick } from "@/worker/scheduler-service";
import { claimNextQueuedRun } from "@/db/repository";
import { processRun } from "@/worker/runner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const expected = process.env.SMEPOST_SCHEDULER_TOKEN;
  if (!expected || request.headers.get("authorization") !== `Bearer ${expected}`) return fail("Unauthorized", 401);
  const scheduled = await schedulerTick();
  if (scheduled.processed) return ok(scheduled);
  const run = await claimNextQueuedRun();
  if (!run) return ok({ processed: false });
  await processRun(run);
  return ok({ processed: true, runId: run.id });
}
