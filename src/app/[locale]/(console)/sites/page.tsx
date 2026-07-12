"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Globe2, Plus } from "lucide-react";
import useSWR from "swr";
import type { SiteRecord } from "@/lib/types";
import { swrFetcher } from "@/lib/api-client";
import { useI18n } from "@/lib/i18n";
import { localizedPath } from "@/lib/i18n-config";
import { Button } from "@/components/ui/button";
import { useConsoleHeaderActions } from "@/components/ui/console-header-actions";
import { ConsolePagination, useClampConsolePage, usePagedItems } from "@/components/ui/console-pagination";

export default function SitesPage() {
  const { t, locale } = useI18n();
  const router = useRouter();
  const { data: sites = [] } = useSWR<SiteRecord[]>("/api/sites", swrFetcher);
  const [page, setPage] = useState(1);
  const { pageItems: visibleSites, safePage } = usePagedItems(sites, page);
  useClampConsolePage(page, sites.length, setPage);

  const headerActions = useMemo(() => (
    <Button onClick={() => router.push(localizedPath(locale, "/sites/list?addSite=1"))}>
      <Plus className="size-4" />
      {t("addSite")}
    </Button>
  ), [locale, router, t]);
  useConsoleHeaderActions(headerActions);

  function siteHref(site: SiteRecord) {
    const params = new URLSearchParams({ siteId: site.id, browserTab: site.id });
    return localizedPath(locale, `/sites/list?${params.toString()}`);
  }

  return (
    <div className="space-y-6">
      <section className="space-y-4">
        <div className="grid gap-2">
          {sites.length === 0 ? (
            <div className="border-y border-dashed border-border py-6 text-center text-sm text-muted-foreground">
              {t("emptySites")}
            </div>
          ) : (
            visibleSites.map((site) => (
              <Link
                key={site.id}
                href={siteHref(site)}
                className="flex items-center gap-3 border-b border-border py-3 text-left transition hover:bg-sky-50"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-2xl bg-sky-50 text-sky-700">
                  <Globe2 className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-foreground">{site.name}</span>
                  <span className="mt-1 block truncate text-xs text-muted-foreground">
                    {site.platform} - {site.account || site.url}
                  </span>
                  <span className="mt-1 block truncate text-xs text-muted-foreground">
                    {new Date(site.updatedAt).toLocaleString()}
                  </span>
                </span>
              </Link>
            ))
          )}
        </div>
        <ConsolePagination page={safePage} totalItems={sites.length} onPageChange={setPage} />
      </section>
    </div>
  );
}