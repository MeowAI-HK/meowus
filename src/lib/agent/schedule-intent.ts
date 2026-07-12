import type { SiteRecord } from "@/lib/types";

const scheduleWords = /\b(schedule|tomorrow|tmr|post.+(?:at|on))\b|聽日|明天|排程|定時/i;
const tomorrowWords = /\b(?:tomorrow|tmr)\b|聽日|明天/i;
const timePattern = /\b(1[0-2]|0?\d)(?::([0-5]\d))?\s*(am|pm)\b|(?:下午|晚上)\s*(\d{1,2})(?:[:：]([0-5]\d))?/i;

export type ScheduleIntent = {
  scheduledAt: number;
  timeZone: string;
  site: SiteRecord;
};

export function looksLikeScheduleRequest(message: string) {
  return scheduleWords.test(message) && timePattern.test(message);
}

export function resolveScheduleIntent(input: {
  message: string;
  sites: SiteRecord[];
  selectedSite?: SiteRecord;
  now?: Date;
}): ScheduleIntent {
  const now = input.now ?? new Date();
  const match = input.message.match(timePattern);
  if (!match) throw new Error("Include a time such as 9pm.");
  if (!tomorrowWords.test(input.message)) {
    throw new Error("This version supports one-time schedules for tomorrow. Include ‘tomorrow’ or ‘tmr’. ");
  }

  let hours = 0;
  let minutes = 0;
  if (match[1]) {
    hours = Number(match[1]) % 12;
    minutes = Number(match[2] ?? 0);
    if (match[3]?.toLowerCase() === "pm") hours += 12;
  } else {
    hours = Number(match[4]);
    minutes = Number(match[5] ?? 0);
    if (hours < 12) hours += 12;
  }

  const scheduled = new Date(now);
  scheduled.setDate(scheduled.getDate() + 1);
  scheduled.setHours(hours, minutes, 0, 0);
  if (scheduled.getTime() <= now.getTime()) throw new Error("The scheduled time must be in the future.");

  const threadsSites = input.sites.filter((site) => site.platform === "Threads");
  let site = input.selectedSite?.platform === "Threads" ? input.selectedSite : undefined;
  if (!site) {
    const message = input.message.toLocaleLowerCase();
    const matches = threadsSites.filter((candidate) =>
      [candidate.name, candidate.account]
        .filter(Boolean)
        .some((value) => message.includes(value.toLocaleLowerCase())),
    );
    if (matches.length !== 1) {
      throw new Error(matches.length > 1
        ? "More than one Threads account matches. Select the account with @."
        : "I could not identify one saved Threads account. Include its name or select it with @.");
    }
    site = matches[0];
  }
  if (!site.profilePath) throw new Error("The selected Threads account has no browser profile.");

  return {
    scheduledAt: scheduled.getTime(),
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "local",
    site,
  };
}
