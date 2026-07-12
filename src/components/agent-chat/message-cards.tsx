"use client";

import * as React from "react";
import { Bot, CalendarClock, Check, ChevronDown, ChevronUp, ImageIcon, Loader2, User, Wrench, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AgentChatMessageWithTools, AgentToolCallRecord, ScheduleRecord, SiteRecord } from "@/lib/types";
import { Button } from "@/components/ui/button";

type MessageCardWrapperProps = {
  icon?: React.ReactNode;
  title?: string;
  description?: React.ReactNode;
  badges?: React.ReactNode[];
  actionButtons?: React.ReactNode;
  children?: React.ReactNode;
  defaultExpanded?: boolean;
  expandLabel?: string;
  collapseLabel?: string;
  className?: string;
};

export function MessageCardWrapper({
  icon,
  title,
  description,
  badges = [],
  actionButtons,
  children,
  defaultExpanded = false,
  expandLabel = "Details",
  collapseLabel = "Collapse",
  className,
}: MessageCardWrapperProps) {
  const [expanded, setExpanded] = React.useState(defaultExpanded);
  const hasExpandableContent = Boolean(children);

  return (
    <div className={cn("w-full", className)}>
      <div className="w-full overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="flex items-center gap-2 px-3 py-2.5 sm:px-4 sm:py-3">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            {icon ? <span className="text-muted-foreground [&_svg]:h-4 [&_svg]:w-4">{icon}</span> : null}
            {title ? <span className="truncate text-sm font-medium text-foreground">{title}</span> : null}
          </div>
          {badges.length ? (
            <div className="flex shrink-0 items-center gap-2">
              {badges.map((badge, index) => (
                <React.Fragment key={index}>{badge}</React.Fragment>
              ))}
            </div>
          ) : null}
        </div>

        {description ? (
          <div className="px-3 pb-2.5 sm:px-4 sm:pb-3">
            <div className="text-sm leading-6 text-muted-foreground">{description}</div>
          </div>
        ) : null}

        {expanded && hasExpandableContent ? (
          <div className="border-t border-border/50 px-3 pb-2.5 pt-2.5 sm:px-4 sm:pb-3 sm:pt-3">
            {children}
          </div>
        ) : null}

        {actionButtons || hasExpandableContent ? (
          <>
            <div className="border-t border-border/50" />
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-2">
              <div className="flex flex-1 flex-wrap gap-1.5">
                {actionButtons}
              </div>
              {hasExpandableContent ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setExpanded((value) => !value)}
                  className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
                >
                  {expanded ? collapseLabel : expandLabel}
                  {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </Button>
              ) : null}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

function StatusBadge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "good" | "warn" | "bad" }) {
  const className = {
    neutral: "bg-zinc-100 text-zinc-600",
    good: "bg-emerald-100 text-emerald-700",
    warn: "bg-amber-100 text-amber-700",
    bad: "bg-rose-100 text-rose-700",
  }[tone];

  return (
    <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-medium", className)}>
      {children}
    </span>
  );
}

function humanizeKey(key: string) {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatValue(value: unknown, labels: { yes: string; no: string; none: string }): React.ReactNode {
  if (typeof value === "boolean") return value ? labels.yes : labels.no;
  if (value === null || value === undefined || value === "") return labels.none;
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.length ? value.map((item) => formatValue(item, labels)).join(", ") : labels.none;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function detailEntries(value: Record<string, unknown> | undefined, fieldLabels: Record<string, string>) {
  return Object.entries(value ?? {}).filter(([, entryValue]) => entryValue !== undefined).map(([key, entryValue]) => ({
    key,
    label: fieldLabels[key] ?? humanizeKey(key),
    value: entryValue,
  }));
}

function imageArtifactUrl(output: Record<string, unknown>) {
  const rawPath = typeof output.path === "string" ? output.path : "";
  if (!rawPath || !/\.(png|jpe?g|webp)$/i.test(rawPath)) return "";
  const fileName = rawPath.split(/[\\/]/).pop() ?? "";
  return fileName ? `/api/agent/artifacts?file=${encodeURIComponent(fileName)}` : "";
}

function DetailList({
  title,
  entries,
  emptyLabel,
  valueLabels,
}: {
  title: string;
  entries: Array<{ key: string; label: string; value: unknown }>;
  emptyLabel: string;
  valueLabels: { yes: string; no: string; none: string };
}) {
  return (
    <div>
      <p className="mb-1 font-medium text-muted-foreground">{title}</p>
      {entries.length ? (
        <dl className="max-h-64 space-y-2 overflow-auto rounded-xl bg-muted p-3 text-foreground">
          {entries.map((entry) => (
            <div key={entry.key} className="grid gap-1 border-b border-border/60 pb-2 last:border-0 last:pb-0">
              <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{entry.label}</dt>
              <dd className="break-words text-xs leading-5">{formatValue(entry.value, valueLabels)}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="rounded-xl bg-muted p-3 text-muted-foreground">{emptyLabel}</p>
      )}
    </div>
  );
}

function InlineDetailList({
  entries,
  emptyLabel,
  valueLabels,
}: {
  entries: Array<{ key: string; label: string; value: unknown }>;
  emptyLabel: string;
  valueLabels: { yes: string; no: string; none: string };
}) {
  if (!entries.length) {
    return <p className="text-xs text-muted-foreground">{emptyLabel}</p>;
  }
  return (
    <dl className="space-y-1">
      {entries.slice(0, 4).map((entry) => (
        <div key={entry.key} className="grid grid-cols-[7rem_1fr] gap-2 text-xs">
          <dt className="truncate font-medium text-muted-foreground">{entry.label}</dt>
          <dd className="truncate text-foreground">{formatValue(entry.value, valueLabels)}</dd>
        </div>
      ))}
    </dl>
  );
}

function ToolApprovalActions({
  disabled,
  approveLabel,
  rejectLabel,
  loadingLabel,
  onApprove,
  onReject,
}: {
  disabled: boolean;
  approveLabel: string;
  rejectLabel: string;
  loadingLabel: string;
  onApprove: () => void;
  onReject: () => void;
}) {
  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onReject}
        disabled={disabled}
        className="h-7 text-xs"
      >
        {disabled ? <Loader2 className="mr-1.5 h-3 w-3 animate-spin" /> : <X className="mr-1.5 h-3 w-3" />}
        {disabled ? loadingLabel : rejectLabel}
      </Button>
      <Button
        type="button"
        size="sm"
        onClick={onApprove}
        disabled={disabled}
        className="h-7 text-xs"
      >
        {disabled ? <Loader2 className="mr-1.5 h-3 w-3 animate-spin" /> : <Check className="mr-1.5 h-3 w-3" />}
        {disabled ? loadingLabel : approveLabel}
      </Button>
    </>
  );
}

export function UserMessageCard({ message, site }: { message: AgentChatMessageWithTools; site?: SiteRecord }) {
  return (
    <article className="flex justify-end">
      <div className="max-w-[85%] rounded-xl bg-[#5B8DEF] px-4 py-3 text-sm leading-6 text-white shadow-sm">
        <div className="mb-1 flex items-center justify-end gap-2 text-xs text-white/80">
          {site ? <span>@{site.name}</span> : null}
          <User className="h-3.5 w-3.5" />
        </div>
        <p className="whitespace-pre-wrap">{message.content}</p>
      </div>
    </article>
  );
}

export function AssistantMessageCard({
  message,
  modeLabel,
  assistantTitle,
  site,
}: {
  message: AgentChatMessageWithTools;
  modeLabel: string;
  assistantTitle: string;
  site?: SiteRecord;
}) {
  return (
    <MessageCardWrapper
      icon={<Bot />}
      title={assistantTitle}
      badges={[
        <StatusBadge key="mode">{modeLabel}</StatusBadge>,
        site ? <StatusBadge key="site" tone="neutral">@{site.name}</StatusBadge> : null,
      ].filter(Boolean) as React.ReactNode[]}
      description={<p className="whitespace-pre-wrap text-foreground">{message.content}</p>}
    />
  );
}

export function SystemMessageCard({ message, title }: { message: AgentChatMessageWithTools; title: string }) {
  return (
    <MessageCardWrapper
      icon={<Bot />}
      title={title}
      description={<p className="whitespace-pre-wrap">{message.content}</p>}
    />
  );
}

export function ScheduledPostMessageCard({
  tool,
  schedule,
  locale,
  labels,
  busy,
  onApprove,
  onReject,
  onCancel,
}: {
  tool: AgentToolCallRecord;
  schedule?: ScheduleRecord;
  locale: string;
  labels: { title: string; approve: string; reject: string; cancel: string; pending: string; account: string; time: string; timezone: string; post: string };
  busy: boolean;
  onApprove: () => void;
  onReject: () => void;
  onCancel: () => void;
}) {
  const scheduledAt = Number(tool.input.scheduledAt);
  const status = schedule?.status ?? (tool.status === "pending" ? "pending" : String(tool.output.status ?? "scheduled"));
  const cancellable = schedule && ["scheduled", "queued"].includes(schedule.status);
  return (
    <MessageCardWrapper
      icon={<CalendarClock />}
      title={labels.title}
      badges={[<StatusBadge key="status" tone={status === "posted" ? "good" : status === "failed" || status === "missed" ? "bad" : "warn"}>{status}</StatusBadge>]}
      description={
        <dl className="grid gap-2 text-xs">
          <div><dt className="font-medium text-muted-foreground">{labels.account}</dt><dd className="text-foreground">{String(tool.input.siteName ?? "")}</dd></div>
          <div><dt className="font-medium text-muted-foreground">{labels.time}</dt><dd className="text-foreground">{Number.isFinite(scheduledAt) ? new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(scheduledAt) : labels.pending}</dd></div>
          <div><dt className="font-medium text-muted-foreground">{labels.timezone}</dt><dd className="text-foreground">{String(tool.input.timeZone ?? "")}</dd></div>
          <div><dt className="font-medium text-muted-foreground">{labels.post}</dt><dd className="whitespace-pre-wrap text-foreground">{String(tool.input.postPreview ?? "")}</dd></div>
        </dl>
      }
      actionButtons={tool.status === "pending" ? (
        <ToolApprovalActions disabled={busy} approveLabel={labels.approve} rejectLabel={labels.reject} loadingLabel={labels.pending} onApprove={onApprove} onReject={onReject} />
      ) : cancellable ? (
        <Button type="button" variant="outline" size="sm" disabled={busy} onClick={onCancel}>{labels.cancel}</Button>
      ) : null}
    />
  );
}

export function ToolCallMessageCard({
  tool,
  labels,
  site,
  approval,
}: {
  tool: AgentToolCallRecord;
  labels: {
    input: string;
    output: string;
    running: string;
    completed: string;
    failed: string;
    details: string;
    collapse: string;
    loginRequired: string;
    empty: string;
    imagePreview: string;
    approve: string;
    reject: string;
    approving: string;
    valueYes: string;
    valueNo: string;
    valueNone: string;
    toolNames: Record<string, string>;
    fieldLabels: Record<string, string>;
  };
  site?: SiteRecord;
  approval?: {
    disabled: boolean;
    onApprove: () => void;
    onReject: () => void;
  };
}) {
  const statusLabel = {
    pending: labels.running,
    running: labels.running,
    completed: labels.completed,
    failed: labels.failed,
  }[tool.status];
  const tone = tool.status === "completed" ? "good" : tool.status === "failed" ? "bad" : "warn";
  const loginRequired = Boolean(tool.output?.loginRequired);
  const inputEntries = detailEntries(tool.input, labels.fieldLabels);
  const outputEntries = detailEntries(tool.output, labels.fieldLabels);
  const imageUrl = imageArtifactUrl(tool.output);
  const valueLabels = { yes: labels.valueYes, no: labels.valueNo, none: labels.valueNone };

  return (
    <MessageCardWrapper
      icon={tool.status === "running" || tool.status === "pending" ? <Loader2 className="animate-spin" /> : <Wrench />}
      title={labels.toolNames[tool.name] ?? humanizeKey(tool.name)}
      badges={[
        <StatusBadge key="status" tone={tone}>{statusLabel}</StatusBadge>,
        site ? <StatusBadge key="site">@{site.name}</StatusBadge> : null,
      ].filter(Boolean) as React.ReactNode[]}
      description={
        <div className="space-y-2">
          {loginRequired ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              {labels.loginRequired}
            </div>
          ) : null}
          <InlineDetailList entries={inputEntries} emptyLabel={labels.empty} valueLabels={valueLabels} />
        </div>
      }
      expandLabel={labels.details}
      collapseLabel={labels.collapse}
      actionButtons={approval && tool.status === "pending" ? (
        <ToolApprovalActions
          disabled={approval.disabled}
          approveLabel={labels.approve}
          rejectLabel={labels.reject}
          loadingLabel={labels.approving}
          onApprove={approval.onApprove}
          onReject={approval.onReject}
        />
      ) : null}
    >
      <div className="grid gap-3 text-xs">
        <DetailList title={labels.output} entries={outputEntries} emptyLabel={labels.empty} valueLabels={valueLabels} />
        {imageUrl ? (
          <figure>
            <figcaption className="mb-1 flex items-center gap-1 font-medium text-muted-foreground">
              <ImageIcon className="h-3.5 w-3.5" />
              {labels.imagePreview}
            </figcaption>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt={labels.imagePreview}
              className="max-h-80 w-full rounded-xl border border-border object-contain bg-muted"
            />
          </figure>
        ) : null}
      </div>
    </MessageCardWrapper>
  );
}
