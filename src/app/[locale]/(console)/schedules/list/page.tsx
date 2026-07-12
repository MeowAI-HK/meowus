"use client";

import { useState } from "react";
import useSWR from "swr";
import type { ScheduleRecord } from "@/lib/types";
import { formatRunTime } from "@/lib/schedule";
import { useI18n } from "@/lib/i18n";
import { swrFetcher } from "@/lib/api-client";
import { ConsolePagination, useClampConsolePage, usePagedItems } from "@/components/ui/console-pagination";
import type { TranslationKey } from "@/lib/locale-resources";

const scheduleStatusLabelKeys: Record<ScheduleRecord["status"], TranslationKey> = {
  scheduled: "scheduleStatusScheduled",
  queued: "scheduleStatusQueued",
  running: "scheduleStatusRunning",
  posted: "scheduleStatusPosted",
  failed: "scheduleStatusFailed",
  missed: "scheduleStatusMissed",
  cancelled: "scheduleStatusCancelled",
};

function scheduleStatusClass(status: ScheduleRecord["status"]) {
  if (status === "scheduled" || status === "queued") return "bg-amber-100 text-amber-700";
  if (status === "running") return "bg-sky-100 text-sky-700";
  if (status === "posted") return "bg-emerald-100 text-emerald-700";
  if (status === "failed" || status === "missed") return "bg-rose-100 text-rose-700";
  return "bg-zinc-100 text-zinc-600";
}

export default function SchedulesListPage() {
  const { t } = useI18n();
  const { data: schedules = [] } = useSWR<ScheduleRecord[]>("/api/schedules", swrFetcher);
  const [page, setPage] = useState(1);
  const { pageItems: visibleSchedules, safePage } = usePagedItems(schedules, page);
  useClampConsolePage(page, schedules.length, setPage);

  return (
    <div className="space-y-6">
      <section className="space-y-4">
        {schedules.length === 0 ? (
          <p className="border-y border-dashed border-border py-6 text-center text-sm text-zinc-500">
            {t("emptySchedules")}
          </p>
        ) : (
          <div className="space-y-3">
            {visibleSchedules.map((schedule) => (
              <div key={schedule.id} className="grid gap-3 border-b border-border py-4 md:grid-cols-[1fr_180px_180px] md:items-center">
                <div>
                  <div className="font-semibold text-zinc-900 text-[15px]">{schedule.playbookId}</div>
                  <p className="text-xs text-zinc-400 mt-1">
                    {t("scheduleTimes")}: {JSON.stringify(schedule.scheduleTimes)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${scheduleStatusClass(schedule.status)}`}>
                    {t(scheduleStatusLabelKeys[schedule.status])}
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${schedule.enabled ? "bg-emerald-100 text-emerald-700" : "bg-zinc-100 text-zinc-600"}`}>
                    {schedule.enabled ? t("enabled") : t("disabled")}
                  </span>
                </div>
                <div className="text-sm text-zinc-500 font-medium">
                  {t("nextRun")}: {formatRunTime(schedule.nextRunAt)}
                </div>
              </div>
            ))}
          </div>
        )}
        <ConsolePagination page={safePage} totalItems={schedules.length} onPageChange={setPage} />
      </section>
    </div>
  );
}
