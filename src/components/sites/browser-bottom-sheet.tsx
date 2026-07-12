"use client";

import { BottomSheet } from "@/components/ui/bottom-sheet";
import { BrowserPanel, type BrowserPanelProps } from "./browser-panel";

type SitesBrowserBottomSheetProps = BrowserPanelProps & {
  open: boolean;
  onClose: () => void;
  title?: string;
};

export function SitesBrowserBottomSheet({
  open,
  onClose,
  title = "Browser",
  ...browserPanelProps
}: SitesBrowserBottomSheetProps) {
  return (
    <BottomSheet open={open} onClose={onClose} title={title} className="h-[82vh] md:hidden">
      <BrowserPanel {...browserPanelProps} className="min-h-0" />
    </BottomSheet>
  );
}