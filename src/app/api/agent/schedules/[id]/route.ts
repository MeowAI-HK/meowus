import { getSchedule, updateSchedule } from "@/db/repository";
import { fail, ok } from "@/lib/api";

export const runtime = "nodejs";

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const schedule = await getSchedule(id);
  if (!schedule) return fail("Schedule not found", 404);
  if (!["scheduled", "queued"].includes(schedule.status)) return fail("This schedule can no longer be cancelled", 409);
  return ok(await updateSchedule(id, { enabled: false, status: "cancelled", nextRunAt: undefined }));
}
