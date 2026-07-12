"use client";

import * as React from "react";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { cn } from "@/lib/utils";

type SitesWorkspaceProps = {
  chatPanel: React.ReactNode;
  browserPanel: React.ReactNode;
  mobileBrowserSheet?: React.ReactNode;
  minPanelWidth?: number;
  className?: string;
};

export function SitesWorkspace({
  chatPanel,
  browserPanel,
  mobileBrowserSheet,
  minPanelWidth = 400,
  className,
}: SitesWorkspaceProps) {
  const panelMinSize = `${minPanelWidth}px`;

  return (
    <div className={cn("h-full bg-card", className)}>
      <div className="h-full">
        <ResizablePanelGroup orientation="horizontal" className="h-full min-w-0 flex-1 group">
          <ResizablePanel defaultSize="48%" minSize={panelMinSize} className="min-w-0">
            {chatPanel}
          </ResizablePanel>
          <ResizableHandle
            withHandle
            className="w-1 bg-transparent after:left-0 after:w-1 after:translate-x-0 after:bg-slate-200/25 hover:after:bg-slate-400/70 group-hover:after:bg-slate-300/60 [&>div]:opacity-0 [&>div]:scale-90 [&>div]:transition-all hover:[&>div]:opacity-100 hover:[&>div]:scale-100 group-hover:[&>div]:opacity-100 group-hover:[&>div]:scale-100"
          />

          <ResizablePanel
            defaultSize="52%"
            minSize={panelMinSize}
            className="min-w-0 overflow-hidden border-l border-border bg-card"
          >
            {browserPanel}
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      {mobileBrowserSheet}
    </div>
  );
}
