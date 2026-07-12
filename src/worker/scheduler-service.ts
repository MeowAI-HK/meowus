import { createRun, getRun, listRuns, listSchedules, updateSchedule } from "@/db/repository";
import { computeNextRunAt, isDue } from "@/lib/schedule";
import { processRun } from "./runner";

export const missedOneTimeGraceMs = 5 * 60_000;

export function isMissedOneTimeSchedule(input: { dueAt: number; now: number; isOnce: boolean }) {
  return input.isOnce && input.now - input.dueAt > missedOneTimeGraceMs;
}

export async function schedulerTick(now = Date.now()) {
  const schedules = await listSchedules();
  for (const schedule of schedules) {
    if (!schedule.enabled || schedule.status !== "scheduled" || !isDue(schedule.nextRunAt, now)) continue;
    const dueAt = schedule.nextRunAt!;
    const isOnce = schedule.scheduleTimes.some((entry) => entry.type === "once");
    if (isMissedOneTimeSchedule({ dueAt, now, isOnce })) {
      await updateSchedule(schedule.id, { enabled: false, status: "missed", lastRunAt: now });
      continue;
    }
    const duplicate = (await listRuns(200)).find((run) => run.scheduleId === schedule.id && run.params._scheduledFor === dueAt);
    if (duplicate) continue;
    const run = await createRun({
      playbookId: schedule.playbookId,
      siteId: schedule.siteId,
      scheduleId: schedule.id,
      scheduledFor: dueAt,
      params: { ...schedule.params, _scheduledRun: true, _scheduleId: schedule.id, _scheduledFor: dueAt },
    });
    if (!run) throw new Error("Failed to create scheduled run");
    await updateSchedule(schedule.id, {
      enabled: !isOnce,
      status: "queued",
      lastRunAt: now,
      nextRunAt: isOnce ? undefined : computeNextRunAt(schedule.scheduleTimes, new Date(now + 1000)),
    });
    await updateSchedule(schedule.id, { status: "running" });
    await processRun(run);
    const completed = await getRun(run.id);
    await updateSchedule(schedule.id, {
      status: isOnce ? (completed?.status === "success" ? "posted" : "failed") : "scheduled",
      enabled: isOnce ? false : true,
    });
    return { processed: true, runId: run.id, scheduleId: schedule.id };
  }
  return { processed: false };
}
