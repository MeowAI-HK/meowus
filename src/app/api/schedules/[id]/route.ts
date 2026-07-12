import { updateSchedule } from "@/db/repository";
import { fail, ok, parseJson } from "@/lib/api";
import { computeNextRunAt } from "@/lib/schedule";
import { scheduleInputSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const parsed = await parseJson(request, scheduleInputSchema.partial());
  if (parsed.error) {
    return fail("Invalid schedule payload", 400, parsed.error);
  }
  return ok(
    await updateSchedule(id, {
      ...parsed.data,
      nextRunAt: parsed.data.scheduleTimes ? computeNextRunAt(parsed.data.scheduleTimes) : undefined,
    }),
  );
}
