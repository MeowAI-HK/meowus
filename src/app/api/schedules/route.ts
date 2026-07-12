import { createSchedule, listSchedules } from "@/db/repository";
import { fail, ok, parseJson } from "@/lib/api";
import { computeNextRunAt } from "@/lib/schedule";
import { scheduleInputSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function GET() {
  return ok(await listSchedules());
}

export async function POST(request: Request) {
  const parsed = await parseJson(request, scheduleInputSchema);
  if (parsed.error) {
    return fail("Invalid schedule payload", 400, parsed.error);
  }
  const schedule = await createSchedule({
    ...parsed.data,
    nextRunAt: computeNextRunAt(parsed.data.scheduleTimes),
  });
  return ok(schedule, { status: 201 });
}
