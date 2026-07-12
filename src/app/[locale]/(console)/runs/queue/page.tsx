"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { Play, Plus, RefreshCw, CalendarClock } from "lucide-react";
import type { PlaybookId, RunEventRecord, RunRecord, SiteRecord } from "@/lib/types";
import { playbookIds } from "@/lib/types";
import { formatRunTime } from "@/lib/schedule";
import { useI18n } from "@/lib/i18n";
import { apiErrorTranslationKey, apiPost, swrFetcher } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useConsoleHeaderActions } from "@/components/ui/console-header-actions";
import { ConsolePagination, useClampConsolePage, usePagedItems } from "@/components/ui/console-pagination";
import { ConsoleNotice, consoleInputClass } from "@/components/ui/console-surface";

export default function RunsQueuePage() {
  const { t } = useI18n();
  const { data: sites = [] } = useSWR<SiteRecord[]>("/api/sites", swrFetcher);
  const { data: runs = [], mutate: reloadRuns } = useSWR<RunRecord[]>("/api/runs?limit=200", swrFetcher, { refreshInterval: 3000 });
  const latestRunId = runs[0]?.id;
  const { data: events = [] } = useSWR<RunEventRecord[]>(
    latestRunId ? `/api/runs/${latestRunId}/events` : null,
    swrFetcher, { refreshInterval: 2000 },
  );

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [runPlaybook, setRunPlaybook] = useState<PlaybookId>("threads_auto_post");
  const [runSiteId, setRunSiteId] = useState("");
  const [runParams, setRunParams] = useState('{"contentFolder":"","allowNoImage":true,"confirmLivePost":false}');
  const [publishApproved, setPublishApproved] = useState(false);
  const [scheduleTime, setScheduleTime] = useState("09:00");
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const { pageItems: visibleRuns, safePage } = usePagedItems(runs, page);
  useClampConsolePage(page, runs.length, setPage);

  const headerActions = useMemo(() => (
    <>
      <Button variant="secondary" size="sm" onClick={() => reloadRuns()}>
        <RefreshCw size={14} />
        {t("btnUpdateRuns")}
      </Button>
      <Button size="sm" onClick={() => setIsAddOpen(true)}>
        <Plus size={14} />
        {t("queueRun")}
      </Button>
    </>
  ), [reloadRuns, t]);
  useConsoleHeaderActions(headerActions);

  const siteOptions = useMemo(
    () => sites.map((s) => ({ label: `${s.name} (${s.platform})`, value: s.id })),
    [sites],
  );
  const parsedRunParams = useMemo(() => {
    try {
      return JSON.parse(runParams || "{}") as Record<string, unknown>;
    } catch {
      return null;
    }
  }, [runParams]);
  const requiresFinalPublishApproval = runPlaybook === "threads_auto_post" && parsedRunParams?.confirmLivePost === true;

  async function runAction(action: () => Promise<void>) {
    setLoading(true);
    try {
      await action();
    } catch (err) {
      setNotice(t(apiErrorTranslationKey(err, "unknownError")));
    } finally {
      setLoading(false);
    }
  }

  async function handleQueueRun() {
    await runAction(async () => {
      const parsedParams = JSON.parse(runParams || "{}") as Record<string, unknown>;
      if (runPlaybook === "threads_auto_post" && parsedParams.confirmLivePost === true && !publishApproved) {
        throw new Error(t("finalPublishApprovalRequired"));
      }
      const run = await apiPost<RunRecord>("/api/runs", {
        playbookId: runPlaybook,
        siteId: runSiteId || undefined,
        params: {
          ...parsedParams,
          frontendPublishApproved: parsedParams.confirmLivePost === true ? publishApproved : false,
        },
      });
      setNotice(t("runQueuedNotice", { id: run.id }));
      setIsAddOpen(false);
      await reloadRuns();
    });
  }

  async function handleCreateSchedule() {
    await runAction(async () => {
      const parsedParams = JSON.parse(runParams || "{}") as Record<string, unknown>;
      const schedule = await apiPost<{ nextRunAt: number }>("/api/schedules", {
        playbookId: runPlaybook, siteId: runSiteId || undefined,
        enabled: true, scheduleTimes: [{ type: "daily", time: scheduleTime }], params: parsedParams,
      });
      setNotice(t("scheduleCreatedNotice", { time: formatRunTime(schedule.nextRunAt) }));
      setIsAddOpen(false);
    });
  }

  const statusColor = (status: string) => {
    if (status === "success") return "bg-emerald-100 text-emerald-700";
    if (status === "failed") return "bg-red-100 text-red-700";
    return "bg-amber-100 text-amber-700";
  };

  return (
    <div className="space-y-6">
      {notice && (
        <ConsoleNotice message={notice} onDismiss={() => setNotice("")} />
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-4">
          {runs.length === 0 ? (
            <p className="border-y border-dashed border-border py-6 text-center text-sm text-zinc-500">{t("emptyRuns")}</p>
          ) : (
            <div className="space-y-3">
              {visibleRuns.map((run) => (
                <div key={run.id} className="space-y-1 border-b border-border py-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-zinc-800">{run.playbookId}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColor(run.status)}`}>{run.status}</span>
                  </div>
                  <p className="text-xs text-zinc-500">{run.resultMessage || formatRunTime(run.createdAt)}</p>
                </div>
              ))}
            </div>
          )}
          <ConsolePagination page={safePage} totalItems={runs.length} onPageChange={setPage} />
        </section>

        <section>
          <div className="max-h-[520px] overflow-auto bg-sky-950 p-4 font-mono text-[11px] leading-relaxed text-sky-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] space-y-1">
            {events.length === 0 ? (
              <p className="text-sky-200/70">{t("emptyLog")}</p>
            ) : (
              events.map((ev) => (
                <p key={ev.id} className={ev.level === "error" ? "text-red-300" : ev.level === "warn" ? "text-amber-200" : "text-sky-100/80"}>
                  [{new Date(ev.createdAt).toLocaleTimeString("zh-HK")}] {ev.message}
                </p>
              ))
            )}
          </div>
        </section>
      </div>

      <Dialog open={isAddOpen} onClose={() => setIsAddOpen(false)} title={t("queueRun")}>
        <div className="space-y-4">
          <label className="grid gap-1.5 text-sm font-medium text-zinc-700">
            <span>{t("playbook")}</span>
            <select
              value={runPlaybook}
              onChange={(e) => {
                setRunPlaybook(e.target.value as PlaybookId);
                setPublishApproved(false);
              }}
              className={consoleInputClass}
            >
              {playbookIds.map((id) => <option key={id}>{id}</option>)}
            </select>
          </label>
          <label className="grid gap-1.5 text-sm font-medium text-zinc-700">
            <span>{t("site")}</span>
            <select value={runSiteId} onChange={(e) => setRunSiteId(e.target.value)} className={consoleInputClass}>
              <option value="">{t("unspecified")}</option>
              {siteOptions.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </label>
          <label className="grid gap-1.5 text-sm font-medium text-zinc-700">
            <span>{t("paramsJson")}</span>
            <textarea value={runParams} onChange={(e) => {
              setRunParams(e.target.value);
              setPublishApproved(false);
            }}
              className={`${consoleInputClass} min-h-20 resize-none font-mono text-xs`} />
          </label>
          <div className={`rounded-xl border px-3 py-2 text-xs ${requiresFinalPublishApproval ? "border-amber-200 bg-amber-50 text-amber-800" : "border-emerald-100 bg-emerald-50 text-emerald-700"}`}>
            <p className="font-semibold">{requiresFinalPublishApproval ? t("livePublishEnabled") : t("dryRunOnly")}</p>
            {requiresFinalPublishApproval ? (
              <div className="mt-2 space-y-2">
                <p>{t("finalPublishApprovalBody")}</p>
                <label className="flex items-start gap-2 font-medium">
                  <input
                    type="checkbox"
                    checked={publishApproved}
                    onChange={(event) => setPublishApproved(event.target.checked)}
                    className="mt-0.5 size-4"
                  />
                  <span>{t("finalPublishApprovalCheckbox")}</span>
                </label>
              </div>
            ) : null}
          </div>

          <div className="border-t border-zinc-100 pt-4 space-y-3">
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setIsAddOpen(false)}>{t("dlgCancel")}</Button>
              <Button onClick={handleQueueRun} loading={loading}>
                <Play size={14} />
                {t("btnQueueRun")}
              </Button>
            </div>

            <div className="h-px bg-zinc-100" />

            <div className="flex items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-xs font-semibold text-zinc-600">
                <span>{t("dailyTime")}</span>
                <input type="time" value={scheduleTime} onChange={(e) => setScheduleTime(e.target.value)}
                  className="min-h-8 rounded-2xl border border-sky-100 px-2 py-1 text-xs outline-none bg-white transition focus:border-sky-400" />
              </label>
              <Button variant="secondary" size="sm" onClick={handleCreateSchedule}>
                <CalendarClock size={14} />
                {t("btnCreateSchedule")}
              </Button>
            </div>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
