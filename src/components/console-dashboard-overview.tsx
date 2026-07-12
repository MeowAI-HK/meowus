"use client";

import Link from "next/link";
import useSWR from "swr";
import { ArrowRight, CalendarClock, FileText, Globe2, Play } from "lucide-react";
import type { ContentPage, RunRecord, ScheduleRecord, SiteRecord } from "@/lib/types";
import { useI18n } from "@/lib/i18n";
import { localizedPath } from "@/lib/i18n-config";
import { swrFetcher } from "@/lib/api-client";
import { ConsoleCard, ConsoleSectionHeader } from "@/components/ui/console-surface";

function StatCard({
  title,
  value,
  hint,
  href,
  icon: Icon,
  cta,
}: {
  title: string;
  value: number;
  hint: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  cta: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-[28px] border border-sky-100 bg-gradient-to-br from-white via-white to-sky-50/80 p-5 shadow-[0_12px_28px_rgba(37,99,235,0.08)] transition hover:border-sky-200 hover:shadow-[0_18px_36px_rgba(37,99,235,0.12)]"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-zinc-500">{title}</p>
          <p className="mt-3 text-4xl font-semibold tracking-tight text-zinc-950">{value}</p>
          <p className="mt-2 text-sm text-zinc-500">{hint}</p>
        </div>

        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-[0_10px_24px_-12px_rgba(37,99,235,0.55)] transition group-hover:scale-105">
          <Icon className="h-5 w-5" />
        </span>
      </div>

      <div className="mt-5 flex items-center text-sm font-medium text-sky-700 transition group-hover:text-sky-900">
        <span>{cta}</span>
        <ArrowRight className="ml-2 h-4 w-4 transition group-hover:translate-x-0.5" />
      </div>
    </Link>
  );
}

export function ConsoleDashboardOverview() {
  const { t, locale } = useI18n();
  const { data: sites = [] } = useSWR<SiteRecord[]>("/api/sites", swrFetcher);
  const { data: content } = useSWR<ContentPage>("/api/content?page=1&pageSize=1", swrFetcher, { refreshInterval: 5000 });
  const { data: runs = [] } = useSWR<RunRecord[]>("/api/runs", swrFetcher, { refreshInterval: 3000 });
  const { data: schedules = [] } = useSWR<ScheduleRecord[]>("/api/schedules", swrFetcher);

  const activeRuns = runs.filter((run) => run.status === "queued" || run.status === "running").length;
  const enabledSchedules = schedules.filter((schedule) => schedule.enabled).length;

  return (
    <div className="space-y-6">
      <p className="text-sm text-zinc-500">{t("dashboardDescription")}</p>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title={t("dashboardTotalSites")}
          value={sites.length}
          hint={t("dashboardSitesHint")}
          href={localizedPath(locale, "/sites/list")}
          icon={Globe2}
          cta={t("openLabel")}
        />
        <StatCard
          title={t("dashboardTotalContent")}
          value={content?.total ?? 0}
          hint={t("dashboardContentHint")}
          href={localizedPath(locale, "/content/library")}
          icon={FileText}
          cta={t("openLabel")}
        />
        <StatCard
          title={t("dashboardQueuedRuns")}
          value={activeRuns}
          hint={t("dashboardRunsHint")}
          href={localizedPath(locale, "/runs/queue")}
          icon={Play}
          cta={t("openLabel")}
        />
        <StatCard
          title={t("dashboardActiveSchedules")}
          value={enabledSchedules}
          hint={t("dashboardSchedulesHint")}
          href={localizedPath(locale, "/schedules/list")}
          icon={CalendarClock}
          cta={t("openLabel")}
        />
      </div>

      <ConsoleCard>
        <ConsoleSectionHeader
          icon={<Play className="h-5 w-5" />}
          title={t("recentRuns")}
          action={
            <Link href={localizedPath(locale, "/runs/queue")} className="text-sm font-medium text-sky-700 transition hover:text-sky-900">
              {t("openRuns")}
            </Link>
          }
        />

        <div className="mt-4 space-y-3">
          {runs.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-sky-100 px-4 py-8 text-center text-sm text-zinc-500">
              {t("emptyRuns")}
            </p>
          ) : (
            runs.slice(0, 5).map((run) => (
              <div
                key={run.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-sky-100 bg-sky-50/40 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-semibold text-zinc-950">{run.playbookId}</p>
                  <p className="mt-1 text-xs text-zinc-500">{new Date(run.createdAt).toLocaleString()}</p>
                </div>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-medium capitalize text-zinc-600 shadow-sm">
                  {run.status}
                </span>
              </div>
            ))
          )}
        </div>
      </ConsoleCard>
    </div>
  );
}
