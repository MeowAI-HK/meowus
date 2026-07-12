"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import useSWR from "swr";
import {
  CalendarClock,
  ChevronUp,
  FileText,
  Globe2,
  Grid2X2,
  House,
  LogIn,
  LogOut,
  MessageCircle,
  PanelLeftClose,
  PanelLeftOpen,
  Play,
  Plus,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Image as ImageIcon,
  UserCircle,
  WalletCards,
} from "lucide-react";
import { SitesBrowserSheetProvider, useSitesBrowserSheet } from "@/components/sites/browser-sheet-context";
import { ConsoleHeaderActionsProvider, ConsoleHeaderActionsSlot } from "@/components/ui/console-header-actions";
import { LogoButton } from "@/components/ui/logo-button";
import { NavButton } from "@/components/ui/nav-button";
import { useI18n } from "@/lib/i18n";
import { localizedPath, stripLocale, type Locale } from "@/lib/i18n-config";
import { cn } from "@/lib/utils";
import { apiPost, swrFetcher } from "@/lib/api-client";
import type { AgentChatThreadRecord, SiteRecord } from "@/lib/types";

type AccountState = {
  connected: boolean;
  error?: string;
  auth?: {
    baseUrl: string;
    runnerId: string;
    deviceName: string;
    userId?: string;
    connectedAt: number;
    org: {
      id: string;
      name: string;
      planId: string;
      imageCredit?: number;
      llmCredit?: number;
      planLimits?: {
        imageCredits: number;
        llmCredits: number;
      };
    };
  };
};

const ACTIVE_THREAD_STORAGE_KEY = "agent-chat-active-thread-id";

function formatCreditAmount(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: value % 1 === 0 ? 0 : 1,
  }).format(value);
}

function creditPercent(remaining: number, limit: number) {
  if (limit === -1) return 100;
  if (limit <= 0) return 0;
  return Math.max(0, Math.min(100, (remaining / limit) * 100));
}

function AccountDropdownLink({
  href,
  icon,
  label,
  locale,
  onNavigate,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  locale: Locale;
  onNavigate: () => void;
}) {
  return (
    <Link
      href={localizedPath(locale, href)}
      className="flex w-full items-center gap-2 px-3 py-2 text-left text-slate-700 transition hover:bg-sky-50 hover:text-slate-950"
      onClick={onNavigate}
    >
      {icon}
      <span>{label}</span>
    </Link>
  );
}

export default function ConsoleLayout({ children }: { children: React.ReactNode }) {
  return (
    <SitesBrowserSheetProvider>
      <ConsoleHeaderActionsProvider>
        <ConsoleLayoutShell>{children}</ConsoleLayoutShell>
      </ConsoleHeaderActionsProvider>
    </SitesBrowserSheetProvider>
  );
}

function ConsoleLayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "";
  const router = useRouter();
  const routePath = stripLocale(pathname);
  const { t, locale } = useI18n();
  const isSitesCanvas = routePath === "/sites/list" || routePath === "/sites/all";
  const { closeSheet } = useSitesBrowserSheet();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [threadLimit, setThreadLimit] = useState(20);
  const accountMenuRef = useRef<HTMLDivElement | null>(null);
  const { data: sites = [] } = useSWR<SiteRecord[]>("/api/sites", swrFetcher, { refreshInterval: 5000 });
  const { data: threads = [] } = useSWR<AgentChatThreadRecord[]>(`/api/agent/chat/threads?limit=${threadLimit}`, swrFetcher, { refreshInterval: 5000 });
  const { data: account, mutate: reloadAccount } = useSWR<AccountState>("/api/smepost/account", swrFetcher, { refreshInterval: 40_000 });
  const visibleSites = sites.slice(0, 5);

  const primaryMenuItems = useMemo(
    () => [
      { id: "dashboard", name: t("navDashboard"), icon: House, href: "/dashboard", segment: "/dashboard" },
      { id: "sites", name: t("navSites"), icon: Globe2, href: "/sites/list", segment: "/sites" },
      { id: "content", name: t("navContent"), icon: FileText, href: "/content/library", segment: "/content" },
      { id: "runs", name: t("navRuns"), icon: Play, href: "/runs/queue", segment: "/runs" },
      { id: "schedules", name: t("navSchedules"), icon: CalendarClock, href: "/schedules/list", segment: "/schedules" },
      { id: "chatroom", name: t("agentChatShortTitle"), icon: MessageCircle, href: "/chatroom", segment: "/chatroom" },
    ],
    [t],
  );
  const settingsItem = useMemo(
    () => ({ id: "settings", name: t("navSettings"), icon: Settings, href: "/settings", segment: "/settings" }),
    [t],
  );
  const accountItem = useMemo(
    () => ({ id: "account", name: t("navAccount"), icon: UserCircle, href: "/account/smepost", segment: "/account" }),
    [t],
  );
  const mobileMenuItems = useMemo(() => [...primaryMenuItems, accountItem], [accountItem, primaryMenuItems]);
  const activeItem = [...mobileMenuItems, settingsItem].find((item) => routePath.startsWith(item.segment)) ?? primaryMenuItems[0];

  useEffect(() => {
    if (!isSitesCanvas) closeSheet();
  }, [closeSheet, isSitesCanvas]);

  useEffect(() => {
    if (!isAccountMenuOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!accountMenuRef.current?.contains(event.target as Node)) {
        setIsAccountMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsAccountMenuOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isAccountMenuOpen]);

  const renderNavigation = (items: typeof mobileMenuItems, size: "sm" | "default" = "default") =>
    items.map(({ name, icon: Icon, href, segment }) => (
      <Link key={href} href={localizedPath(locale, href)} className="flex flex-1 justify-center md:w-full md:flex-none">
        <NavButton
          icon={<Icon className="h-5 w-5" />}
          label={name}
          size={size}
          isActive={routePath.startsWith(segment) || (segment === "/dashboard" && routePath === "/")}
        />
      </Link>
    ));

  async function logoutSMEPost() {
    await apiPost("/api/smepost/logout", {});
    setIsAccountMenuOpen(false);
    await reloadAccount();
  }

  function siteHref(site: SiteRecord) {
    const params = new URLSearchParams({ siteId: site.id, browserTab: site.id });
    return localizedPath(locale, `/sites/list?${params.toString()}`);
  }

  function threadHref(thread: AgentChatThreadRecord) {
    const params = new URLSearchParams({ threadId: thread.id });
    if (thread.activeSiteId) {
      params.set("siteId", thread.activeSiteId);
      params.set("browserTab", thread.activeSiteId);
    }
    return localizedPath(locale, `/sites/list?${params.toString()}`);
  }

  function startSidebarDraftChat() {
    window.localStorage.removeItem(ACTIVE_THREAD_STORAGE_KEY);
    router.push(localizedPath(locale, `/sites/list?newChat=${Date.now()}`));
  }

  const accountName = account?.connected && account.auth ? account.auth.org.name : "SMEPost";
  const accountPlan = account?.connected && account.auth ? account.auth.org.planId : t("smepostLoginButton");
  const llmCredits = account?.auth?.org.llmCredit ?? 0;
  const imageCredits = account?.auth?.org.imageCredit ?? 0;
  const llmLimit = account?.auth?.org.planLimits?.llmCredits ?? 0;
  const imageLimit = account?.auth?.org.planLimits?.imageCredits ?? 0;

  function handleSidebarContentScroll(event: React.UIEvent<HTMLDivElement>) {
    const target = event.currentTarget;
    if (target.scrollHeight - target.scrollTop - target.clientHeight > 96) return;
    if (threads.length < threadLimit) return;
    setThreadLimit((current) => current + 20);
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-white md:bg-gradient-to-b md:from-sky-50 md:via-sky-50 md:to-slate-100">
      <aside
        className={cn(
          "hidden shrink-0 flex-col border-r border-border/80 bg-gradient-to-b from-sky-50 via-sky-50 to-slate-100 transition-[width] duration-200 md:flex",
          isSidebarCollapsed ? "w-[56px]" : "w-[260px]",
        )}
      >
        <div className={cn("flex h-full min-h-0 flex-col", isSidebarCollapsed ? "items-center px-2 py-3" : "px-3 py-3")}>
          <div className={cn("flex h-11 w-full items-center", isSidebarCollapsed ? "justify-center" : "justify-between gap-2")}>
            <div className={cn("flex min-w-0 items-center gap-2", isSidebarCollapsed && "justify-center")}>
              {isSidebarCollapsed ? (
                <button
                  type="button"
                  onClick={() => setIsSidebarCollapsed(false)}
                  className="group relative flex size-10 items-center justify-center rounded-lg text-slate-500 transition hover:bg-white/80 hover:text-slate-900"
                  aria-label={t("expandSitesSidebar")}
                  title={t("expandSitesSidebar")}
                >
                  <Image
                    src="/logo.webp"
                    alt={t("productName")}
                    width={32}
                    height={32}
                    priority
                    className="transition group-hover:opacity-0"
                  />
                  <PanelLeftOpen className="absolute size-4 opacity-0 transition group-hover:opacity-100" />
                </button>
              ) : (
                <>
              <LogoButton href={localizedPath(locale, "/dashboard")} size="sm" ariaLabel={t("productName")} />
                <Link href={localizedPath(locale, "/dashboard")} className="truncate text-base font-bold text-slate-950">
                  {t("productName")}
                </Link>
                </>
              )}
            </div>
            {!isSidebarCollapsed ? (
              <button
                type="button"
                onClick={() => setIsSidebarCollapsed(true)}
                className="flex size-8 shrink-0 items-center justify-center rounded-lg text-slate-500 transition hover:bg-white/80 hover:text-slate-900"
                aria-label={t("collapseSitesSidebar")}
                title={t("collapseSitesSidebar")}
              >
                <PanelLeftClose className="size-4" />
              </button>
            ) : null}
          </div>

          <nav className={cn("mt-4 flex flex-col", isSidebarCollapsed ? "items-center gap-2" : "gap-1")} aria-label={t("consoleNavigation")}>
            {primaryMenuItems.map(({ name, icon: Icon, href, segment }) => {
              const isActive = routePath.startsWith(segment) || (segment === "/dashboard" && routePath === "/");
              const navLink = (
                <Link
                  key={href}
                  href={localizedPath(locale, href)}
                  title={isSidebarCollapsed ? name : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-lg text-sm font-medium transition",
                    isSidebarCollapsed ? "size-9 justify-center" : "h-9 px-2",
                    isActive ? "bg-white text-sky-700 shadow-sm ring-1 ring-sky-100" : "text-slate-600 hover:bg-white/80 hover:text-slate-950",
                  )}
                >
                  <Icon className="size-4 shrink-0" />
                  {!isSidebarCollapsed ? <span className="truncate">{name}</span> : null}
                </Link>
              );

              if (segment === "/sites" && !isSidebarCollapsed) {
                return (
                  <div key={href} className="flex items-center gap-1">
                    <div className="min-w-0 flex-1">{navLink}</div>
                    <Link
                      href={localizedPath(locale, "/sites/all")}
                      className="flex size-9 shrink-0 items-center justify-center rounded-lg text-slate-500 transition hover:bg-white/80 hover:text-slate-950"
                      aria-label={t("siteGridMenu")}
                      title={t("siteGridMenu")}
                    >
                      <Grid2X2 className="size-4" />
                    </Link>
                  </div>
                );
              }

              return (
                navLink
              );
            })}
          </nav>

          {!isSidebarCollapsed ? (
            <div className="mt-5 min-h-0 flex-1 overflow-y-auto pr-1" onScroll={handleSidebarContentScroll}>
              <section>
                <div className="mb-2 flex items-center justify-between gap-2 px-2">
                  <Link
                    href={localizedPath(locale, "/sites")}
                    className="text-xs font-semibold uppercase text-slate-500 transition hover:text-slate-900"
                  >
                    {t("sitesSidebarTitle")}
                  </Link>
                  <Link
                    href={localizedPath(locale, "/sites/list?addSite=1")}
                    className="flex size-7 items-center justify-center rounded-lg text-slate-500 transition hover:bg-white/80 hover:text-slate-950"
                    aria-label={t("addSite")}
                    title={t("addSite")}
                  >
                    <Plus className="size-4" />
                  </Link>
                </div>
                <div className="max-h-[26vh] space-y-1 overflow-y-auto pr-1">
                  {sites.length === 0 ? (
                    <p className="px-2 py-2 text-xs text-slate-500">{t("emptySites")}</p>
                  ) : (
                    visibleSites.map((site) => (
                      <Link
                        key={site.id}
                        href={siteHref(site)}
                        className={cn(
                          "flex min-w-0 items-center gap-2 rounded-lg px-2 py-2 text-sm text-slate-700 transition hover:bg-white/80 hover:text-slate-950",
                          routePath.startsWith("/sites") && "hover:bg-white",
                        )}
                      >
                        <Globe2 className="size-4 shrink-0 text-slate-400" />
                        <span className="truncate">{site.name}</span>
                      </Link>
                    ))
                  )}
                </div>
              </section>

              <section className="mt-5">
                <div className="mb-2 flex items-center justify-between gap-2 px-2">
                  <Link
                    href={localizedPath(locale, "/chatroom")}
                    className="text-xs font-semibold uppercase text-slate-500 transition hover:text-slate-900"
                  >
                    {t("sidebarRecent")}
                  </Link>
                  <button
                    type="button"
                    onClick={startSidebarDraftChat}
                    className="flex size-7 items-center justify-center rounded-lg text-slate-500 transition hover:bg-white/80 hover:text-slate-950"
                    aria-label={t("agentNewChat")}
                    title={t("agentNewChat")}
                  >
                    <MessageCircle className="size-4" />
                  </button>
                </div>
                <div className="space-y-1">
                  {threads.length === 0 ? (
                    <p className="px-2 py-2 text-xs text-slate-500">{t("agentLoadingHistory")}</p>
                  ) : (
                    threads.map((thread) => (
                      <Link
                        key={thread.id}
                        href={threadHref(thread)}
                        onClick={() => window.localStorage.setItem(ACTIVE_THREAD_STORAGE_KEY, thread.id)}
                        className="block min-w-0 rounded-lg px-2 py-2 text-sm text-slate-700 transition hover:bg-white/80 hover:text-slate-950"
                      >
                        <span className="block truncate">{thread.title || t("agentChatShortTitle")}</span>
                      </Link>
                    ))
                  )}
                </div>
              </section>
            </div>
          ) : (
            <div className="min-h-0 flex-1" />
          )}

          <div ref={accountMenuRef} className={cn("relative mt-3 w-full border-t border-slate-200 pt-3", isSidebarCollapsed && "flex justify-center")}>
            {isAccountMenuOpen ? (
              <div className="absolute bottom-full left-0 z-50 mb-2 w-64 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 text-sm shadow-xl">
                {account?.connected && account.auth ? (
                  <div className="border-b border-slate-100 px-3 py-2">
                    <p className="truncate font-semibold text-slate-900">{account.auth.org.name}</p>
                    <p className="mt-1 text-xs capitalize text-slate-500">{account.auth.org.planId}</p>
                    <div className="mt-3 space-y-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-3 text-xs text-slate-600">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-slate-700">{t("sidebarCreditBalance")}</span>
                        <span className="text-[11px] text-slate-500">{t("sidebarLlmImageCredits")}</span>
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="flex items-center gap-1.5 text-slate-500">
                            <Sparkles className="size-3.5" />
                            {t("sidebarLlmCredits")}
                          </span>
                          <span className="font-medium tabular-nums text-slate-800">
                            {llmLimit === -1 ? t("sidebarCreditUnlimited") : `${formatCreditAmount(llmCredits)} / ${formatCreditAmount(llmLimit)}`}
                          </span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
                          <div className="h-full rounded-full bg-sky-600" style={{ width: `${creditPercent(llmCredits, llmLimit)}%` }} />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="flex items-center gap-1.5 text-slate-500">
                            <ImageIcon className="size-3.5" />
                            {t("sidebarImageCredits")}
                          </span>
                          <span className="font-medium tabular-nums text-slate-800">
                            {`${formatCreditAmount(imageCredits)} / ${formatCreditAmount(imageLimit)}`}
                          </span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
                          <div className="h-full rounded-full bg-sky-600" style={{ width: `${creditPercent(imageCredits, imageLimit)}%` }} />
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}
                <AccountDropdownLink href="/settings" icon={<SlidersHorizontal className="size-4" />} label={t("sidebarRuntimeConfig")} locale={locale} onNavigate={() => setIsAccountMenuOpen(false)} />
                <AccountDropdownLink href="/settings/permissions" icon={<ShieldCheck className="size-4" />} label={t("settingsTabPermissions")} locale={locale} onNavigate={() => setIsAccountMenuOpen(false)} />
                <AccountDropdownLink href="/settings/language" icon={<Globe2 className="size-4" />} label={t("settingsTabLanguage")} locale={locale} onNavigate={() => setIsAccountMenuOpen(false)} />
                <AccountDropdownLink href="/settings/brand" icon={<WalletCards className="size-4" />} label={t("settingsTabBrand")} locale={locale} onNavigate={() => setIsAccountMenuOpen(false)} />
                <AccountDropdownLink href="/settings/prompt" icon={<MessageCircle className="size-4" />} label={t("settingsTabPrompt")} locale={locale} onNavigate={() => setIsAccountMenuOpen(false)} />
                <Link
                  href={localizedPath(locale, "/account/smepost")}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-slate-700 transition hover:bg-sky-50 hover:text-slate-950"
                  onClick={() => setIsAccountMenuOpen(false)}
                >
                  {account?.connected ? <WalletCards className="size-4" /> : <LogIn className="size-4" />}
                  <span>{account?.connected ? t("navAccount") : t("smepostLoginButton")}</span>
                </Link>
                {account?.connected ? (
                  <button
                    type="button"
                    onClick={() => void logoutSMEPost()}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-slate-700 transition hover:bg-sky-50 hover:text-slate-950"
                  >
                    <LogOut className="size-4" />
                    <span>{t("smepostLogout")}</span>
                  </button>
                ) : null}
              </div>
            ) : null}
            <button
              type="button"
              onClick={() => setIsAccountMenuOpen((current) => !current)}
              className={cn(
                "flex items-center rounded-lg text-left transition hover:bg-white/80",
                isSidebarCollapsed ? "size-9 justify-center" : "w-full gap-2 px-2 py-2",
              )}
              aria-label={accountName}
              aria-expanded={isAccountMenuOpen}
              title={isSidebarCollapsed ? accountName : undefined}
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-violet-500 text-[10px] font-bold uppercase text-white">
                {accountName.slice(0, 2)}
              </span>
              {!isSidebarCollapsed ? (
                <>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-slate-900">{accountName}</span>
                    <span className="block truncate text-xs text-slate-500">{accountPlan}</span>
                  </span>
                  <ChevronUp className="size-4 shrink-0 text-slate-400" />
                </>
              ) : null}
            </button>
          </div>
        </div>
      </aside>

      <div className={cn("flex min-w-0 flex-1 flex-col bg-white pb-20 md:bg-transparent md:pb-0", !isSitesCanvas && "lg:m-3")}>
        {isSitesCanvas ? (
          children
        ) : (
          <main className="flex min-w-0 flex-1 flex-col bg-card md:overflow-hidden md:rounded-lg md:border md:border-border md:shadow-sm">
            <header className="sticky top-0 z-10 flex min-h-14 items-center justify-between gap-3 border-b bg-background/60 px-4 py-2 backdrop-blur-sm sm:px-6">
              <h1 className="truncate text-sm font-semibold text-foreground sm:text-base">{activeItem.name}</h1>
              <ConsoleHeaderActionsSlot />
            </header>
            <div className="flex-1 overflow-auto p-4 md:p-6">{children}</div>
          </main>
        )}
      </div>

      <nav
        className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-white/90 px-2 pb-4 pt-3 backdrop-blur-md md:hidden"
        aria-label={t("mobileNavigation")}
      >
        <div className="flex items-center justify-around">{renderNavigation(mobileMenuItems, "sm")}</div>
      </nav>
    </div>
  );
}
