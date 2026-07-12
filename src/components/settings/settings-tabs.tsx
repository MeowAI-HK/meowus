"use client";

import { useRouter } from "next/navigation";
import { localizedPath } from "@/lib/i18n-config";
import { useI18n } from "@/lib/i18n";

export type SettingsTab = "runtime" | "permissions" | "language" | "brand" | "prompt";

export const settingsTabs: SettingsTab[] = ["runtime", "permissions", "language", "brand", "prompt"];

export function SettingsTabs({ activeTab }: { activeTab: SettingsTab }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const tabs: Array<{ id: SettingsTab; label: string; href: string }> = [
    { id: "runtime", label: t("settingsTabRuntime"), href: "/settings" },
    { id: "permissions", label: t("settingsTabPermissions"), href: "/settings/permissions" },
    { id: "language", label: t("settingsTabLanguage"), href: "/settings/language" },
    { id: "brand", label: t("settingsTabBrand"), href: "/settings/brand" },
    { id: "prompt", label: t("settingsTabPrompt"), href: "/settings/prompt" },
  ];

  return (
    <div className="flex w-full gap-2 overflow-x-auto border-b border-border pb-2">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => router.push(localizedPath(locale, tab.href))}
          className={`shrink-0 rounded-lg px-4 py-2 text-sm font-semibold transition ${
            activeTab === tab.id ? "bg-sky-600 text-white shadow-sm" : "text-zinc-500 hover:bg-sky-50 hover:text-zinc-900"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
