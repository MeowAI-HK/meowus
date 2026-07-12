"use client";

import * as React from "react";

type SitesBrowserSheetContextValue = {
  isOpen: boolean;
  openSheet: () => void;
  closeSheet: () => void;
  setOpen: (open: boolean) => void;
};

const SitesBrowserSheetContext = React.createContext<SitesBrowserSheetContextValue | null>(null);

export function SitesBrowserSheetProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setOpen] = React.useState(false);

  const value = React.useMemo(
    () => ({
      isOpen,
      openSheet: () => setOpen(true),
      closeSheet: () => setOpen(false),
      setOpen,
    }),
    [isOpen],
  );

  return (
    <SitesBrowserSheetContext.Provider value={value}>
      {children}
    </SitesBrowserSheetContext.Provider>
  );
}

export function useSitesBrowserSheet() {
  const context = React.useContext(SitesBrowserSheetContext);

  if (!context) {
    throw new Error("useSitesBrowserSheet must be used within SitesBrowserSheetProvider");
  }

  return context;
}