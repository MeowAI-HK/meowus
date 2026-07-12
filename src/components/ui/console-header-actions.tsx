"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

type ConsoleHeaderActionsContextValue = {
  actions: React.ReactNode;
  setActions: (actions: React.ReactNode) => void;
};

const ConsoleHeaderActionsContext = createContext<ConsoleHeaderActionsContextValue | null>(null);

export function ConsoleHeaderActionsProvider({ children }: { children: React.ReactNode }) {
  const [actions, setActions] = useState<React.ReactNode>(null);
  const value = useMemo(() => ({ actions, setActions }), [actions]);

  return (
    <ConsoleHeaderActionsContext.Provider value={value}>
      {children}
    </ConsoleHeaderActionsContext.Provider>
  );
}

export function useConsoleHeaderActions(actions: React.ReactNode) {
  const context = useContext(ConsoleHeaderActionsContext);
  const setActions = context?.setActions;

  useEffect(() => {
    if (!setActions) return;
    setActions(actions);
    return () => setActions(null);
  }, [actions, setActions]);
}

export function ConsoleHeaderActionsSlot() {
  const context = useContext(ConsoleHeaderActionsContext);
  return context?.actions ? <div className="flex shrink-0 items-center gap-2">{context.actions}</div> : null;
}
