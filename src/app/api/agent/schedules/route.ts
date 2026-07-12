import { z } from "zod";
import { createSchedule, getAgentToolCall, getContentItem, getSite, updateAgentToolCall } from "@/db/repository";
import { fail, ok, parseJson } from "@/lib/api";

export const runtime = "nodejs";

const schema = z.object({ toolCallId: z.string().min(1), approved: z.boolean() });

export async function POST(request: Request) {
  const parsed = await parseJson(request, schema);
  if (parsed.error) return fail("Invalid schedule approval payload", 400, parsed.error);
  const tool = await getAgentToolCall(parsed.data.toolCallId);
  if (!tool || tool.name !== "schedule_threads_post" || tool.status !== "pending") {
    return fail("Pending scheduled post approval not found", 404);
  }
  if (!parsed.data.approved) {
    await updateAgentToolCall(tool.id, { status: "failed", output: { status: "cancelled" } });
    return ok({ status: "cancelled" });
  }

  const scheduledAt = Number(tool.input.scheduledAt);
  const siteId = typeof tool.input.siteId === "string" ? tool.input.siteId : "";
  const contentItemId = typeof tool.input.contentItemId === "string" ? tool.input.contentItemId : "";
  const [site, content] = await Promise.all([getSite(siteId), getContentItem(contentItemId)]);
  if (!Number.isFinite(scheduledAt) || scheduledAt <= Date.now()) return fail("Scheduled time is no longer in the future", 409);
  if (!site || site.platform !== "Threads" || !site.profilePath) return fail("Valid Threads profile not found", 409);
  if (!content) return fail("Scheduled content no longer exists", 409);

  const schedule = await createSchedule({
    playbookId: "threads_auto_post",
    siteId,
    enabled: true,
    scheduleTimes: [{ type: "once", at: new Date(scheduledAt).toISOString() }],
    params: { contentItemId, scheduledPublishAuthorized: true },
    nextRunAt: scheduledAt,
    contentItemId,
    publishAuthorized: true,
  });
  if (!schedule) return fail("Failed to create schedule", 500);
  await updateAgentToolCall(tool.id, { status: "completed", output: { scheduleId: schedule.id, status: schedule.status } });
  return ok(schedule);
}
