"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, ExternalLink, Loader2, LogOut, Monitor, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { apiErrorTranslationKey, apiGet, apiPost } from "@/lib/api-client";
import type { TranslationKey } from "@/lib/locale-resources";
import { SMEPOST_DEFAULT_DEVICE_NAME } from "@/features/smepost/constants";

type AccountOrg = {
  id: string;
  name: string;
  planId: string;
};

type AccountState = {
  connected: boolean;
  error?: string;
  auth?: {
    baseUrl: string;
    runnerId: string;
    deviceName: string;
    userId?: string;
    connectedAt: number;
    org: AccountOrg;
  };
};

type DeviceStart = {
  baseUrl: string;
  deviceCode: string;
  pollingToken: string;
  loginUrl: string;
  expiresAt: string;
};

const unlockRows = [
  ["smepostUnlockAgent", "smepostUnlockAgentFree", "smepostUnlockAgentPaid"],
  ["smepostUnlockBrowser", "smepostUnlockBrowserFree", "smepostUnlockBrowserPaid"],
  ["smepostUnlockLlm", "smepostUnlockLlmFree", "smepostUnlockLlmPaid"],
  ["smepostUnlockImage", "smepostUnlockImageFree", "smepostUnlockImagePaid"],
] as const;

export default function SMEPostAccountPage() {
  const { t } = useI18n();
  const [account, setAccount] = useState<AccountState>({ connected: false });
  const [loading, setLoading] = useState(true);
  const [loginSession, setLoginSession] = useState<DeviceStart | null>(null);
  const [isStartingLogin, setIsStartingLogin] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [notice, setNotice] = useState("");

  const setErrorNotice = useCallback((error: unknown, fallback: TranslationKey) => {
    setNotice(t(apiErrorTranslationKey(error, fallback)));
  }, [t]);

  const refreshAccount = useCallback(async () => {
    setLoading(true);
    try {
      const next = await apiGet<AccountState>("/api/smepost/account");
      setAccount(next);
      if (next.error) {
        setNotice(t("error_SMEPOST_SESSION_EXPIRED"));
      }
    } catch (error) {
      setErrorNotice(error, "smepostAccountLoadFailed");
    } finally {
      setLoading(false);
    }
  }, [setErrorNotice, t]);

  useEffect(() => {
    window.queueMicrotask(() => void refreshAccount());
  }, [refreshAccount]);

  useEffect(() => {
    if (!loginSession || account.connected) {
      return;
    }

    let cancelled = false;
    window.queueMicrotask(() => setIsPolling(true));
    const interval = window.setInterval(async () => {
      try {
        const result = await apiGet<{ status: string; org?: AccountOrg }>(
          `/api/smepost/device/poll?pollingToken=${encodeURIComponent(loginSession.pollingToken)}&baseUrl=${encodeURIComponent(loginSession.baseUrl)}&deviceName=${encodeURIComponent(SMEPOST_DEFAULT_DEVICE_NAME)}`,
        );

        if (cancelled) return;
        if (result.status === "registered") {
          window.clearInterval(interval);
          setLoginSession(null);
          setNotice(t("smepostLoginConnected"));
          await refreshAccount();
        } else if (result.status === "expired") {
          window.clearInterval(interval);
          setNotice(t("smepostLoginExpired"));
        }
      } catch (error) {
        if (cancelled) return;
        window.clearInterval(interval);
        setErrorNotice(error, "smepostLoginFailed");
      } finally {
        if (!cancelled) {
          setIsPolling(false);
        }
      }
    }, 2500);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.queueMicrotask(() => setIsPolling(false));
    };
  }, [account.connected, loginSession, refreshAccount, setErrorNotice, t]);

  async function startLogin() {
    setIsStartingLogin(true);
    setNotice("");
    try {
      const session = await apiPost<DeviceStart>("/api/smepost/device/start", { deviceName: SMEPOST_DEFAULT_DEVICE_NAME });
      setLoginSession(session);
      window.open(session.loginUrl, "_blank", "noopener,noreferrer");
      setNotice(t("smepostLoginWaiting"));
    } catch (error) {
      setErrorNotice(error, "smepostLoginStartFailed");
    } finally {
      setIsStartingLogin(false);
    }
  }

  async function logout() {
    await apiPost("/api/smepost/logout", {});
    setLoginSession(null);
    await refreshAccount();
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <section className="border-b border-border pb-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="mb-3 flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Monitor className="size-5" />
            </div>
            <h2 className="text-xl font-semibold text-foreground">{t("smepostAccountTitle")}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              {t("smepostAccountDescription")}
            </p>
          </div>
          <Button variant="outline" onClick={refreshAccount} disabled={loading}>
            {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            {t("btnUpdateRuns")}
          </Button>
        </div>
      </section>

      {account.connected && account.auth ? (
        <section className="grid gap-4 md:grid-cols-2">
          <div className="border-b border-border pb-4 md:border-b-0 md:border-r md:pr-4">
            <div className="flex items-center gap-2 text-sm font-medium text-emerald-600">
              <CheckCircle2 className="size-4" />
              {t("smepostConnected")}
            </div>
            <p className="mt-3 text-lg font-semibold">{account.auth.org.name}</p>
            <p className="mt-1 text-sm text-muted-foreground">{account.auth.baseUrl}</p>
          </div>
          <div className="border-b border-border pb-4 md:border-b-0 md:pr-4">
            <p className="text-sm text-muted-foreground">{t("smepostPlan")}</p>
            <p className="mt-3 text-lg font-semibold capitalize">{account.auth.org.planId}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t("smepostRunnerLabel")} {account.auth.runnerId}</p>
          </div>
          <div className="md:col-span-2">
            <Button variant="outline" onClick={logout}>
              <LogOut className="size-4" />
              {t("smepostLogout")}
            </Button>
          </div>
        </section>
      ) : (
        <section className="overflow-hidden">
          <div className="pb-5">
            <h3 className="text-base font-semibold">{t("smepostNotConnected")}</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{t("smepostLoginDescription")}</p>
          </div>

          <div className="border-y border-border py-5">
            <h4 className="text-sm font-semibold text-foreground">{t("smepostUnlockTitle")}</h4>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{t("smepostUnlockDescription")}</p>
            <div className="mt-4 overflow-x-auto border-y border-border">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">{t("smepostUnlockFeature")}</th>
                    <th className="px-4 py-3">{t("smepostUnlockFree")}</th>
                    <th className="px-4 py-3">{t("smepostUnlockPaid")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {unlockRows.map(([feature, free, paid]) => (
                    <tr key={feature}>
                      <td className="px-4 py-3 font-medium text-foreground">{t(feature)}</td>
                      <td className="px-4 py-3 text-muted-foreground">{t(free)}</td>
                      <td className="px-4 py-3 text-muted-foreground">{t(paid)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-5">
            <Button onClick={startLogin} disabled={isStartingLogin || isPolling}>
              {isStartingLogin || isPolling ? <Loader2 className="size-4 animate-spin" /> : <ExternalLink className="size-4" />}
              {t("smepostUnlockCta")}
            </Button>
            {loginSession ? (
              <p className="text-sm text-muted-foreground">
                {t("smepostDeviceCode")}: <span className="font-mono text-foreground">{loginSession.deviceCode}</span>
              </p>
            ) : null}
          </div>
        </section>
      )}

      {notice ? (
        <div className="border-l-2 border-border bg-muted px-4 py-3 text-sm text-muted-foreground">
          {notice}
        </div>
      ) : null}
    </div>
  );
}
