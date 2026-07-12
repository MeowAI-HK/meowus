import type { SiteRecord } from "@/lib/types";

export type BrowserPreviewState = {
  siteId: string;
  siteName: string;
  profilePath: string;
  status: "idle" | "starting" | "ready" | "error" | "closed";
  error?: string;
  pageUrl?: string;
  startedAt?: number;
  updatedAt?: number;
  lastFrameAt?: number;
  hasFrame: boolean;
};

export type SiteFormState = {
  name: string;
  platform: SiteRecord["platform"];
  url: string;
  account: string;
  memo: string;
  status: SiteRecord["status"];
};

export const previewStatusText: Record<BrowserPreviewState["status"], string> = {
  idle: "Idle",
  starting: "Starting",
  ready: "Live",
  error: "Error",
  closed: "Closed",
};

export const previewStatusClass: Record<BrowserPreviewState["status"], string> = {
  idle: "bg-zinc-100 text-zinc-600",
  starting: "bg-amber-100 text-amber-700",
  ready: "bg-emerald-100 text-emerald-700",
  error: "bg-red-100 text-red-700",
  closed: "bg-zinc-200 text-zinc-600",
};

export const previewShellStatusText: Record<BrowserPreviewState["status"], string> = {
  idle: "IDLE",
  starting: "STARTING",
  ready: "LIVE",
  error: "ERROR",
  closed: "CLOSED",
};

export const BROWSER_TABS_STORAGE_KEY = "sites-browser-panel-tabs";
export const BROWSER_ACTIVE_TAB_STORAGE_KEY = "sites-browser-panel-active";

export type SiteGridLayout = "3x2" | "4x2" | "3x3" | "4x3";

export const siteGridLayouts: Array<{
  value: SiteGridLayout;
  columns: number;
  rows: number;
}> = [
  { value: "3x2", columns: 3, rows: 2 },
  { value: "4x2", columns: 4, rows: 2 },
  { value: "3x3", columns: 3, rows: 3 },
  { value: "4x3", columns: 4, rows: 3 },
];

export function parseSiteGridLayout(value: string | null | undefined): SiteGridLayout {
  return siteGridLayouts.some((layout) => layout.value === value)
    ? (value as SiteGridLayout)
    : "3x2";
}

export function getSiteGridLayout(value: SiteGridLayout) {
  return siteGridLayouts.find((layout) => layout.value === value) ?? siteGridLayouts[0];
}

export const platformOptions: SiteRecord["platform"][] = [
  "Threads",
  "Facebook",
  "Instagram",
  "WordPress",
  "LinkedIn",
  "YouTube",
  "TikTok",
  "Other",
];

export const platformDefaultUrls: Record<SiteRecord["platform"], string> = {
  Threads: "https://www.threads.com/",
  Facebook: "https://www.facebook.com/",
  Instagram: "https://www.instagram.com/",
  WordPress: "https://wordpress.com/",
  LinkedIn: "https://www.linkedin.com/",
  YouTube: "https://www.youtube.com/",
  TikTok: "https://www.tiktok.com/",
  Other: "",
};

export function defaultUrlForPlatform(platform: SiteRecord["platform"]) {
  return platformDefaultUrls[platform];
}

export function changeSiteFormPlatform(form: SiteFormState, platform: SiteRecord["platform"], updateUrl: boolean) {
  return {
    ...form,
    platform,
    url: updateUrl ? defaultUrlForPlatform(platform) : form.url,
  };
}

export const siteStatusText: Record<SiteRecord["status"], string> = {
  active: "Active",
  paused: "Paused",
  needs_login: "Needs login",
};

export const siteStatusClass: Record<SiteRecord["status"], string> = {
  active: "bg-emerald-100 text-emerald-700",
  paused: "bg-amber-100 text-amber-700",
  needs_login: "bg-zinc-100 text-zinc-600",
};

export const inputClass =
  "min-h-10 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none transition focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 bg-white";

export function createEmptySiteForm(): SiteFormState {
  return {
    name: "",
    platform: "Threads",
    url: defaultUrlForPlatform("Threads"),
    account: "",
    memo: "",
    status: "needs_login",
  };
}

export function siteFormFromSite(site: SiteRecord): SiteFormState {
  return {
    name: site.name,
    platform: site.platform,
    url: site.url,
    account: site.account,
    memo: site.memo,
    status: site.status,
  };
}

export function parseStoredTabIds(value: string | null) {
  if (!value) {
    return [] as string[];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [] as string[];
  }
}

export function buildPreviewErrorState(site: SiteRecord | undefined, siteId: string, message: string): BrowserPreviewState {
  return {
    siteId,
    siteName: site?.name || "",
    profilePath: site?.profilePath || "",
    status: "error",
    error: message,
    hasFrame: false,
  };
}

export function profileLabelFromPath(profilePath: string | undefined) {
  if (!profilePath) {
    return "default";
  }

  const normalized = profilePath.replace(/\\/g, "/");
  const segments = normalized.split("/").filter(Boolean);
  return segments[segments.length - 1] || "default";
}

export function formatSiteUrl(url: string) {
  if (!url) {
    return "Not configured";
  }

  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname === "/" ? "" : parsed.pathname;
    return `${parsed.host}${pathname}`;
  } catch {
    return url;
  }
}
