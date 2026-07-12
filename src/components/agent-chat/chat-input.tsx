"use client";

import * as React from "react";
import { ArrowUp, AtSign, Globe2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AgentRuntimeMode, SiteRecord } from "@/lib/types";

type ChatInputProps = {
  value: string;
  selectedSiteId: string;
  sites: SiteRecord[];
  disabled?: boolean;
  placeholder: string;
  sendLabel: string;
  emptyMentionLabel: string;
  targetSiteLabel: string;
  runtimeMode: AgentRuntimeMode;
  runtimeLocalLabel: string;
  runtimeCloudLabel: string;
  runtimeCloudLoginLabel: string;
  cloudLoginRequiredLabel: string;
  cloudUnavailable?: boolean;
  onChange: (value: string) => void;
  onSelectSite: (site: SiteRecord) => void;
  onRuntimeModeChange: (mode: AgentRuntimeMode) => void;
  onSubmit: () => void;
};

function findMentionQuery(value: string, caret: number) {
  const beforeCaret = value.slice(0, caret);
  const match = beforeCaret.match(/(^|\s)@([^\s@]*)$/);
  if (!match) {
    return null;
  }

  const token = match[2] ?? "";
  return {
    query: token.toLowerCase(),
    start: beforeCaret.length - token.length - 1,
    end: caret,
  };
}

export function ChatInput({
  value,
  selectedSiteId,
  sites,
  disabled,
  placeholder,
  sendLabel,
  emptyMentionLabel,
  targetSiteLabel,
  runtimeMode,
  runtimeLocalLabel,
  runtimeCloudLabel,
  runtimeCloudLoginLabel,
  cloudLoginRequiredLabel,
  cloudUnavailable,
  onChange,
  onSelectSite,
  onRuntimeModeChange,
  onSubmit,
}: ChatInputProps) {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const [mention, setMention] = React.useState<{ query: string; start: number; end: number } | null>(null);
  const selectedSite = sites.find((site) => site.id === selectedSiteId);
  const suggestions = React.useMemo(() => {
    if (!mention) return [];
    return sites
      .filter((site) => {
        const haystack = `${site.name} ${site.platform} ${site.account} ${site.url}`.toLowerCase();
        return haystack.includes(mention.query);
      })
      .slice(0, 8);
  }, [mention, sites]);

  const resize = React.useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "0px";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 220)}px`;
  }, []);

  React.useEffect(() => {
    resize();
  }, [resize, value]);

  const syncMention = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    setMention(findMentionQuery(textarea.value, textarea.selectionStart));
  };

  const selectSite = (site: SiteRecord) => {
    if (!mention) return;
    const nextValue = `${value.slice(0, mention.start)}@${site.name} ${value.slice(mention.end)}`;
    onChange(nextValue);
    onSelectSite(site);
    setMention(null);
    window.requestAnimationFrame(() => {
      textareaRef.current?.focus();
      const caret = mention.start + site.name.length + 2;
      textareaRef.current?.setSelectionRange(caret, caret);
    });
  };

  return (
    <div className="relative rounded-xl border border-border/60 bg-white shadow-sm">
      {mention ? (
        <div className="absolute bottom-full left-3 z-50 mb-2 w-[280px] overflow-hidden rounded-xl border border-border/50 bg-white shadow-lg">
          <div className="max-h-[260px] overflow-y-auto py-1">
            {suggestions.length === 0 ? (
              <div className="px-3 py-2 text-xs text-muted-foreground">{emptyMentionLabel}</div>
            ) : (
              suggestions.map((site) => (
                <button
                  key={site.id}
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition hover:bg-muted/60"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => selectSite(site)}
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-sky-50 text-sky-600">
                    <Globe2 className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">@{site.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">{site.platform} - {site.account || site.url}</span>
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}

      <div className="flex items-start gap-3 px-3 py-3">
        <textarea
          ref={textareaRef}
          value={value}
          rows={1}
          placeholder={placeholder}
          disabled={disabled}
          onChange={(event) => {
            const nextValue = event.target.value;
            onChange(nextValue);
            setMention(findMentionQuery(nextValue, event.target.selectionStart));
            window.requestAnimationFrame(() => {
              resize();
            });
          }}
          onClick={syncMention}
          onKeyUp={syncMention}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setMention(null);
            }
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              onSubmit();
            }
          }}
          className="min-h-8 flex-1 resize-none border-0 bg-transparent px-0 py-1 text-sm leading-6 outline-none placeholder:text-muted-foreground/70 disabled:opacity-60"
          style={{ maxHeight: 220 }}
        />
        <button
          type="button"
          disabled={disabled || !value.trim()}
          onClick={onSubmit}
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all md:h-8 md:w-8",
            disabled || !value.trim()
              ? "cursor-not-allowed bg-muted text-muted-foreground"
              : "bg-primary text-primary-foreground hover:bg-primary/90",
          )}
          aria-label={sendLabel}
          title={sendLabel}
        >
          <ArrowUp className="h-5 w-5 md:h-4 md:w-4" />
        </button>
      </div>

      <div className="border-t border-border/40" />
      <div className="flex items-center gap-2 px-3 py-2.5 text-xs text-muted-foreground md:py-2">
        <AtSign className="h-4 w-4" />
        <span className="truncate">
          {targetSiteLabel}: {selectedSite ? selectedSite.name : "-"}
        </span>
        <select
          value={runtimeMode}
          onChange={(event) => onRuntimeModeChange(event.target.value as AgentRuntimeMode)}
          className={cn(
            "shrink-0 rounded-full border border-sky-100 bg-sky-50 px-2 py-0.5 font-semibold text-sky-700 outline-none transition focus:border-sky-400",
            cloudUnavailable && runtimeMode !== "cloud" ? "text-zinc-500" : "",
          )}
          title={cloudUnavailable ? cloudLoginRequiredLabel : undefined}
        >
          <option value="local">{runtimeLocalLabel}</option>
          <option value="cloud">{cloudUnavailable ? runtimeCloudLoginLabel : runtimeCloudLabel}</option>
        </select>
      </div>
    </div>
  );
}
