"use client";

import { useEffect, useRef, useState } from "react";
import useSWR from "swr";
import { Download, ExternalLink, ImagePlus, RotateCcw, Save, Trash2 } from "lucide-react";
import type { BrandSettings } from "@/lib/types";
import { useI18n } from "@/lib/i18n";
import { apiDelete, apiPost, swrFetcher, type ApiResponse } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { ConsoleNotice, consoleInputClass } from "@/components/ui/console-surface";
import { SettingsTabs } from "./settings-tabs";

type BrandResponse = BrandSettings & { logoUrl: string };
type PromptResponse = {
  systemPrompt: string;
  defaultSystemPrompt: string;
  usingDefault: boolean;
};
type AccountResponse = {
  connected: boolean;
};

async function uploadLogo(file: File) {
  const formData = new FormData();
  formData.set("file", file);
  const response = await fetch("/api/settings/brand/logo", { method: "POST", body: formData });
  const json = await response.json() as ApiResponse<{ logoUrl: string }>;
  if (!json.ok) throw new Error(json.error);
  return json.data;
}

export default function BrandPromptSettingsClient({ tab }: { tab: "brand" | "prompt" }) {
  const { t } = useI18n();
  const [notice, setNotice] = useState("");
  const [noticeTone, setNoticeTone] = useState<"success" | "error">("success");
  const [saving, setSaving] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const { data: brandData, mutate: reloadBrand } = useSWR<BrandResponse>(
    tab === "brand" ? "/api/settings/brand" : null,
    swrFetcher,
  );
  const { data: promptData, mutate: reloadPrompt } = useSWR<PromptResponse>(
    tab === "prompt" ? "/api/settings/prompt" : null,
    swrFetcher,
  );
  const { data: account } = useSWR<AccountResponse>(
    tab === "brand" ? "/api/smepost/account" : null,
    swrFetcher,
    { refreshInterval: 40_000 },
  );
  const [brand, setBrand] = useState<BrandResponse | null>(null);
  const [systemPrompt, setSystemPrompt] = useState("");

  useEffect(() => {
    if (brandData) window.queueMicrotask(() => setBrand(brandData));
  }, [brandData]);

  useEffect(() => {
    if (promptData) window.queueMicrotask(() => setSystemPrompt(promptData.systemPrompt));
  }, [promptData]);

  function showNotice(message: string, tone: "success" | "error" = "success") {
    setNotice(message);
    setNoticeTone(tone);
  }

  async function saveBrand() {
    if (!brand) return;
    setSaving(true);
    try {
      await apiPost("/api/settings/brand", brand);
      await reloadBrand();
      showNotice(t("settingsSaved"));
    } catch (error) {
      showNotice(error instanceof Error ? error.message : t("unknownError"), "error");
    } finally {
      setSaving(false);
    }
  }

  async function savePrompt(nextPrompt = systemPrompt) {
    setSaving(true);
    try {
      await apiPost("/api/settings/prompt", { systemPrompt: nextPrompt });
      setSystemPrompt(nextPrompt);
      await reloadPrompt();
      showNotice(t("settingsSaved"));
    } catch (error) {
      showNotice(error instanceof Error ? error.message : t("unknownError"), "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleLogo(file?: File) {
    if (!file) return;
    setSaving(true);
    try {
      await uploadLogo(file);
      await reloadBrand();
      showNotice(t("brandLogoUploaded"));
    } catch (error) {
      showNotice(error instanceof Error ? error.message : t("unknownError"), "error");
    } finally {
      setSaving(false);
      if (logoInputRef.current) logoInputRef.current.value = "";
    }
  }

  async function removeLogo() {
    setSaving(true);
    try {
      await apiDelete("/api/settings/brand/logo");
      await reloadBrand();
      showNotice(t("brandLogoRemoved"));
    } catch (error) {
      showNotice(error instanceof Error ? error.message : t("unknownError"), "error");
    } finally {
      setSaving(false);
    }
  }

  async function importBrandFromSMEPost() {
    setSaving(true);
    try {
      const imported = await apiPost<BrandResponse>("/api/smepost/brand/import", {});
      setBrand(imported);
      await reloadBrand();
      showNotice(t("brandImportSuccess"));
    } catch (error) {
      showNotice(error instanceof Error ? error.message : t("unknownError"), "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {notice ? <ConsoleNotice message={notice} tone={noticeTone} onDismiss={() => setNotice("")} /> : null}
      <SettingsTabs activeTab={tab} />

      {tab === "brand" && brand ? (
        <section className="space-y-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <p className="text-sm leading-6 text-zinc-500">{t("brandSettingsDescription")}</p>
            {account?.connected ? (
              <Button variant="ghost" onClick={() => void importBrandFromSMEPost()} disabled={saving}>
                <Download size={16} />
                {t("brandImportFromSMEPost")}
              </Button>
            ) : account ? (
              <a
                href="https://smepost.io/tools/brand-dna"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-sky-100 bg-white px-3 py-2 text-sm font-medium text-sky-700 shadow-sm transition hover:border-sky-200 hover:bg-sky-50"
              >
                <ExternalLink size={16} />
                {t("brandGenerateWithBrandDna")}
              </a>
            ) : null}
          </div>
          {account && !account.connected ? (
            <div className="rounded-lg border border-sky-100 bg-sky-50 px-4 py-3 text-sm leading-6 text-sky-900">
              <p>{t("brandDnaGuestDescription")}</p>
              <p className="mt-1 font-mono text-xs text-sky-700">https://smepost.io/tools/brand-dna</p>
            </div>
          ) : null}
          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-1.5 text-sm font-medium text-zinc-700">
              <span>{t("brandName")}</span>
              <input value={brand.name} onChange={(event) => setBrand({ ...brand, name: event.target.value })} className={consoleInputClass} />
            </label>
            <label className="grid gap-1.5 text-sm font-medium text-zinc-700">
              <span>{t("brandTargetAudience")}</span>
              <input value={brand.targetAudience} onChange={(event) => setBrand({ ...brand, targetAudience: event.target.value })} className={consoleInputClass} />
            </label>
          </div>
          <label className="grid gap-1.5 text-sm font-medium text-zinc-700">
            <span>{t("brandDescription")}</span>
            <textarea value={brand.description} onChange={(event) => setBrand({ ...brand, description: event.target.value })} className={`${consoleInputClass} min-h-32 resize-y`} />
          </label>
          <label className="grid gap-1.5 text-sm font-medium text-zinc-700">
            <span>{t("brandVoice")}</span>
            <textarea value={brand.voice} onChange={(event) => setBrand({ ...brand, voice: event.target.value })} className={`${consoleInputClass} min-h-24 resize-y`} />
          </label>
          <div className="grid gap-4 sm:grid-cols-3">
            {(["primary", "accent", "background"] as const).map((key) => (
              <label key={key} className="grid gap-1.5 text-sm font-medium text-zinc-700">
                <span>{t(`brandColor_${key}`)}</span>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={brand.colors[key] || "#ffffff"}
                    onChange={(event) => setBrand({ ...brand, colors: { ...brand.colors, [key]: event.target.value } })}
                    className="h-10 w-12 rounded-xl border border-sky-100 bg-white p-1"
                  />
                  <input
                    value={brand.colors[key]}
                    onChange={(event) => setBrand({ ...brand, colors: { ...brand.colors, [key]: event.target.value } })}
                    placeholder="#000000"
                    className={consoleInputClass}
                  />
                </div>
              </label>
            ))}
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium text-zinc-700">{t("brandLogo")}</p>
            <div className="flex flex-wrap items-center gap-3">
              {brand.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`${brand.logoUrl}?v=${encodeURIComponent(brand.logoPath ?? "")}`} alt={t("brandLogo")} className="size-20 rounded-2xl border border-sky-100 object-contain" />
              ) : null}
              <input ref={logoInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(event) => void handleLogo(event.target.files?.[0])} />
              <Button variant="ghost" onClick={() => logoInputRef.current?.click()} disabled={saving}>
                <ImagePlus size={16} />
                {t("brandLogoUpload")}
              </Button>
              {brand.logoUrl ? (
                <Button variant="ghost" onClick={() => void removeLogo()} disabled={saving}>
                  <Trash2 size={16} />
                  {t("brandLogoRemove")}
                </Button>
              ) : null}
              <span className="text-xs text-zinc-400">{t("brandLogoHint")}</span>
            </div>
          </div>
          <Button onClick={() => void saveBrand()} loading={saving}>
            <Save size={16} />
            {t("btnSaveSettings")}
          </Button>
        </section>
      ) : null}

      {tab === "prompt" && promptData ? (
        <section className="space-y-5">
          <div className="rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm leading-6 text-sky-900">
            {t("promptSettingsDescription")}
          </div>
          <label className="grid gap-1.5 text-sm font-medium text-zinc-700">
            <span>{t("promptCustomLabel")}</span>
            <textarea
              value={systemPrompt}
              onChange={(event) => setSystemPrompt(event.target.value)}
              placeholder={promptData.defaultSystemPrompt}
              className={`${consoleInputClass} min-h-64 resize-y font-mono`}
            />
            <span className="text-xs font-normal text-zinc-400">
              {systemPrompt.trim() ? t("promptCustomActive") : t("promptUsingDefault")}
            </span>
          </label>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void savePrompt()} loading={saving}>
              <Save size={16} />
              {t("btnSaveSettings")}
            </Button>
            <Button variant="ghost" onClick={() => void savePrompt("")} disabled={saving}>
              <RotateCcw size={16} />
              {t("promptRestoreDefault")}
            </Button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
