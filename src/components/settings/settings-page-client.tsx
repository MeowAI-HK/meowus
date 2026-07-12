"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { ShieldCheck } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useI18n, type Locale } from "@/lib/i18n";
import type { TranslationKey } from "@/lib/locale-resources";
import { ApiClientError, apiPost, swrFetcher } from "@/lib/api-client";
import { localeLabel, locales, localizedPath, stripLocale } from "@/lib/i18n-config";
import { aiProviderOrder, aiProviderRegistry } from "@/features/ai-settings/provider-registry";
import { Button } from "@/components/ui/button";
import { ConsoleNotice, consoleInputClass } from "@/components/ui/console-surface";
import { SegmentedControl, SelectField } from "@/components/ui/form-controls";
import type { AgentPermissionMode, AgentRuntimeMode, LocalAIProvider, LocalAgentSettings, LocalImageProvider } from "@/lib/types";
import { SettingsTabs, settingsTabs, type SettingsTab } from "./settings-tabs";
type SettingsResponse = LocalAgentSettings & {
  geminiKey: string;
  groqKey: string;
  openAIKey: string;
  openRouterKey: string;
};
type ModelListResponse = {
  models: Array<{ id: string; label: string }>;
};

type SettingsPageClientProps = {
  initialTab?: SettingsTab;
};

function providerLabel(
  t: (key: TranslationKey, params?: Record<string, string | number>) => string,
  provider: LocalAIProvider | LocalImageProvider,
) {
  if (provider === "gemini") return t("providerGemini");
  if (provider === "groq") return t("providerGroq");
  if (provider === "openai") return t("providerOpenAI");
  return t("providerOpenRouter");
}

function ModelInput({
  id,
  label,
  value,
  models,
  placeholder,
  hint,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  models: ModelListResponse["models"] | undefined;
  placeholder: string;
  hint: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-1.5 text-sm font-medium text-zinc-700">
      <span>{label}</span>
      <input
        value={value}
        list={id}
        onChange={(event) => onChange(event.target.value)}
        className={consoleInputClass}
        placeholder={placeholder}
      />
      <datalist id={id}>
        {(models ?? []).map((model) => (
          <option key={model.id} value={model.id}>
            {model.label}
          </option>
        ))}
      </datalist>
      <span className="text-xs font-normal text-zinc-400">{hint}</span>
    </label>
  );
}

export function isSettingsTab(value: string | undefined): value is SettingsTab {
  return settingsTabs.includes(value as SettingsTab);
}

export default function SettingsPageClient({ initialTab = "runtime" }: SettingsPageClientProps) {
  const { t, locale } = useI18n();
  const pathname = usePathname() || "/settings";
  const router = useRouter();
  const activeTab = initialTab;
  const [notice, setNotice] = useState("");
  const [noticeType, setNoticeType] = useState<"success" | "error">("success");
  const [form, setForm] = useState<SettingsResponse | null>(null);
  const [saving, setSaving] = useState(false);

  const { data: initialData, mutate: reloadSettings } = useSWR<SettingsResponse>(
    "/api/settings/ai",
    swrFetcher,
    { revalidateOnFocus: false },
  );
  const modelListEnabled = form?.runtimeMode === "local";
  const { data: textModelData } = useSWR<ModelListResponse>(
    modelListEnabled ? `/api/settings/ai/models?provider=${form.textProvider}&capability=text` : null,
    swrFetcher,
    { revalidateOnFocus: false },
  );
  const { data: imageModelData } = useSWR<ModelListResponse>(
    modelListEnabled ? `/api/settings/ai/models?provider=${form.imageProvider}&capability=image` : null,
    swrFetcher,
    { revalidateOnFocus: false },
  );

  useEffect(() => {
    if (initialData) {
      window.queueMicrotask(() => setForm(initialData));
    }
  }, [initialData]);

  function showNotice(msg: string, type: "success" | "error" = "success") {
    setNotice(msg);
    setNoticeType(type);
  }

  function errorNotice(error: unknown) {
    if (error instanceof ApiClientError && error.code) {
      const key = `error_${error.code}` as Parameters<typeof t>[0];
      return t(key);
    }
    return error instanceof Error ? error.message : t("unknownError");
  }

  function updateForm(patch: Partial<SettingsResponse>) {
    setForm((current) => (current ? { ...current, ...patch } : current));
  }

  function updatePermission(key: keyof LocalAgentSettings["agentPermissions"], value: AgentPermissionMode) {
    setForm((current) => current ? {
      ...current,
      agentPermissions: { ...current.agentPermissions, [key]: value },
    } : current);
  }

  async function handleSaveSettings() {
    if (!form) return;
    setSaving(true);
    try {
      await apiPost("/api/settings/ai", form);
      showNotice(t("settingsSaved"));
      await reloadSettings();
    } catch (err) {
      showNotice(errorNotice(err), "error");
    } finally {
      setSaving(false);
    }
  }

  const permissionRows: Array<{ key: keyof LocalAgentSettings["agentPermissions"]; label: string }> = [
    { key: "browserStep", label: t("permissionBrowserStep") },
    { key: "browserPostContent", label: t("permissionBrowserPostContent") },
    { key: "generateImage", label: t("permissionGenerateImage") },
    { key: "generatePostContent", label: t("permissionGeneratePostContent") },
    { key: "schedulePost", label: t("permissionSchedulePost") },
  ];

  function textModelValue() {
    if (!form) return "";
    if (form.textProvider === "gemini") return form.geminiModel;
    if (form.textProvider === "groq") return form.groqModel;
    if (form.textProvider === "openai") return form.openAIModel;
    return form.openRouterModel;
  }

  function updateTextModel(model: string) {
    if (!form) return;
    if (form.textProvider === "gemini") updateForm({ geminiModel: model });
    else if (form.textProvider === "groq") updateForm({ groqModel: model });
    else if (form.textProvider === "openai") updateForm({ openAIModel: model });
    else updateForm({ openRouterModel: model });
  }

  function imageModelValue() {
    if (!form) return "";
    return form.imageProvider === "gemini" ? form.geminiImageModel : form.openAIImageModel;
  }

  function updateImageModel(model: string) {
    if (!form) return;
    if (form.imageProvider === "gemini") updateForm({ geminiImageModel: model });
    else updateForm({ openAIImageModel: model });
  }

  const modelInputCopy = {
    placeholder: t("modelAutoPlaceholder"),
    hint: t("modelListHint"),
  };

  return (
    <div className="space-y-6">
      {notice ? <ConsoleNotice message={notice} tone={noticeType} onDismiss={() => setNotice("")} /> : null}

      <SettingsTabs activeTab={activeTab} />

      {form ? (
        <>
          {activeTab === "runtime" ? (
            <section className="w-full space-y-5">
              <SegmentedControl<AgentRuntimeMode>
                value={form.runtimeMode}
                options={[
                  { value: "local", label: t("runtimeLocal") },
                  { value: "cloud", label: t("runtimeCloud") },
                ]}
                onChange={(runtimeMode) => updateForm({ runtimeMode })}
              />
              {form.runtimeMode === "cloud" ? (
                <div className="border-l-2 border-sky-300 bg-sky-50 px-4 py-3 text-sm leading-6 text-sky-800">
                  {t("cloudRuntimeDescription")}
                </div>
              ) : (
                <div className="w-full space-y-5">
                  <section className="space-y-4 border-b border-border pb-5">
                    <SelectField<LocalAIProvider>
                      label={t("textProvider")}
                      value={form.textProvider}
                      options={aiProviderOrder.map((provider) => ({
                        value: provider,
                        label: t(aiProviderRegistry[provider].displayNameKey as Parameters<typeof t>[0]),
                      }))}
                      onChange={(textProvider) => updateForm({ textProvider })}
                    />

                    <div className="grid gap-4 md:grid-cols-2">
                      {form.textProvider === "gemini" ? (
                        <>
                          <label className="grid gap-1.5 text-sm font-medium text-zinc-700">
                            <span>{t("geminiKey")}</span>
                            <input type="password" value={form.geminiKey} onChange={(event) => updateForm({ geminiKey: event.target.value })} className={`${consoleInputClass} font-mono`} />
                          </label>
                          <ModelInput id="text-models" label={t("textModel")} value={textModelValue()} models={textModelData?.models} onChange={updateTextModel} {...modelInputCopy} />
                        </>
                      ) : null}
                      {form.textProvider === "groq" ? (
                        <>
                          <label className="grid gap-1.5 text-sm font-medium text-zinc-700">
                            <span>{t("groqKey")}</span>
                            <input type="password" value={form.groqKey} onChange={(event) => updateForm({ groqKey: event.target.value })} className={`${consoleInputClass} font-mono`} />
                          </label>
                          <ModelInput id="text-models" label={t("textModel")} value={textModelValue()} models={textModelData?.models} onChange={updateTextModel} {...modelInputCopy} />
                        </>
                      ) : null}
                      {form.textProvider === "openai" ? (
                        <>
                          <label className="grid gap-1.5 text-sm font-medium text-zinc-700">
                            <span>{t("openAIKey")}</span>
                            <input type="password" value={form.openAIKey} onChange={(event) => updateForm({ openAIKey: event.target.value })} className={`${consoleInputClass} font-mono`} />
                          </label>
                          <label className="grid gap-1.5 text-sm font-medium text-zinc-700">
                            <span>{t("openAIBaseUrl")}</span>
                            <input value={form.openAIBaseUrl} onChange={(event) => updateForm({ openAIBaseUrl: event.target.value })} className={consoleInputClass} />
                          </label>
                          <ModelInput id="text-models" label={t("textModel")} value={textModelValue()} models={textModelData?.models} onChange={updateTextModel} {...modelInputCopy} />
                        </>
                      ) : null}
                      {form.textProvider === "openrouter" ? (
                        <>
                          <label className="grid gap-1.5 text-sm font-medium text-zinc-700">
                            <span>{t("openRouterKey")}</span>
                            <input type="password" value={form.openRouterKey} onChange={(event) => updateForm({ openRouterKey: event.target.value })} className={`${consoleInputClass} font-mono`} />
                          </label>
                          <label className="grid gap-1.5 text-sm font-medium text-zinc-700">
                            <span>{t("openRouterBaseUrl")}</span>
                            <input value={form.openRouterBaseUrl} onChange={(event) => updateForm({ openRouterBaseUrl: event.target.value })} className={consoleInputClass} />
                          </label>
                          <ModelInput id="text-models" label={t("openRouterModel")} value={textModelValue()} models={textModelData?.models} onChange={updateTextModel} {...modelInputCopy} />
                        </>
                      ) : null}
                    </div>
                  </section>

                  <section className="space-y-4 border-b border-border pb-5">
                    <SelectField<LocalImageProvider>
                      label={t("imageProvider")}
                      value={form.imageProvider}
                      options={(["openai", "gemini"] as LocalImageProvider[]).map((provider) => ({
                        value: provider,
                        label: providerLabel(t, provider),
                      }))}
                      onChange={(imageProvider) => updateForm({ imageProvider })}
                    />
                    {form.imageProvider === "openai" ? (
                      <div className="grid gap-4 md:grid-cols-2">
                        <label className="grid gap-1.5 text-sm font-medium text-zinc-700">
                          <span>{t("openAIKey")}</span>
                          <input type="password" value={form.openAIKey} onChange={(event) => updateForm({ openAIKey: event.target.value })} className={`${consoleInputClass} font-mono`} />
                        </label>
                        <label className="grid gap-1.5 text-sm font-medium text-zinc-700">
                          <span>{t("openAIBaseUrl")}</span>
                          <input value={form.openAIBaseUrl} onChange={(event) => updateForm({ openAIBaseUrl: event.target.value })} className={consoleInputClass} />
                        </label>
                        <ModelInput id="image-models" label={t("openAIImageModel")} value={imageModelValue()} models={imageModelData?.models} onChange={updateImageModel} {...modelInputCopy} />
                        <label className="grid gap-1.5 text-sm font-medium text-zinc-700">
                          <span>{t("imageSize")}</span>
                          <input value={form.openAIImageSize} onChange={(event) => updateForm({ openAIImageSize: event.target.value })} className={consoleInputClass} />
                        </label>
                      </div>
                    ) : null}
                    {form.imageProvider === "gemini" ? (
                      <div className="grid gap-4 md:grid-cols-2">
                        <label className="grid gap-1.5 text-sm font-medium text-zinc-700">
                          <span>{t("geminiKey")}</span>
                          <input type="password" value={form.geminiKey} onChange={(event) => updateForm({ geminiKey: event.target.value })} className={`${consoleInputClass} font-mono`} />
                        </label>
                        <ModelInput id="image-models" label={t("imageModel")} value={imageModelValue()} models={imageModelData?.models} onChange={updateImageModel} {...modelInputCopy} />
                      </div>
                    ) : null}
                  </section>
                </div>
              )}
            </section>
          ) : null}

          {activeTab === "permissions" ? (
            <section className="w-full space-y-5">
              <p className="text-sm leading-6 text-zinc-500">{t("permissionHint")}</p>
              <div className="grid gap-3">
                {permissionRows.map((row) => (
                  <div key={row.key} className="flex flex-wrap items-center justify-between gap-3 border-b border-border py-3">
                    <span className="text-sm font-semibold text-zinc-700">{row.label}</span>
                    <SegmentedControl<AgentPermissionMode>
                      value={form.agentPermissions[row.key]}
                      options={[
                        { value: "confirm", label: t("permissionConfirm") },
                        { value: "auto", label: t("permissionAuto") },
                      ]}
                      onChange={(value) => updatePermission(row.key, value)}
                    />
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {activeTab === "language" ? (
            <section className="w-full space-y-5">
              <SelectField<Locale>
                label={t("langSelect")}
                value={locale}
                options={locales.map((loc) => ({ value: loc, label: localeLabel(loc) }))}
                onChange={(nextLocale) => router.push(localizedPath(nextLocale, stripLocale(pathname)))}
              />
            </section>
          ) : null}

          <div className="flex w-full flex-wrap gap-2">
            <Button onClick={handleSaveSettings} loading={saving}>
              <ShieldCheck size={16} />
              {t("btnSaveSettings")}
            </Button>
          </div>
        </>
      ) : null}
    </div>
  );
}
