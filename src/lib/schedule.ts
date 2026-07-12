import type { ScheduleTime } from "./types";

const minuteMs = 60_000;
const dayMs = 24 * 60 * minuteMs;

export function computeNextRunAt(scheduleTimes: ScheduleTime[], from = new Date()) {
  const candidates = scheduleTimes
    .map((entry) => {
      if (entry.type === "once") {
        const at = Date.parse(entry.at);
        return Number.isFinite(at) && at > from.getTime() ? at : null;
      }

      const [hours, minutes] = entry.time.split(":").map(Number);
      const next = new Date(from);
      next.setSeconds(0, 0);
      next.setHours(hours, minutes, 0, 0);
      if (next.getTime() <= from.getTime()) {
        next.setTime(next.getTime() + dayMs);
      }
      return next.getTime();
    })
    .filter((value): value is number => typeof value === "number");

  return candidates.length > 0 ? Math.min(...candidates) : undefined;
}

export function isDue(nextRunAt: number | undefined, from = Date.now()) {
  return typeof nextRunAt === "number" && nextRunAt <= from;
}

export function formatRunTime(timestamp?: number) {
  if (!timestamp) {
    return "未設定";
  }
  return new Intl.DateTimeFormat("zh-HK", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp));
}
