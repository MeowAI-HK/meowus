"use client";

import { useEffect } from "react";

export function ElectronModeMarker() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (navigator.userAgent.includes("Electron/") || params.get("electron") === "1") {
      document.documentElement.dataset.electron = "true";
    }
  }, []);

  return null;
}
