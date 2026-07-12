import type { SiteRecord } from "@/lib/types";
import { useI18n } from "@/lib/i18n";
import {
  type SiteFormState,
  changeSiteFormPlatform,
  inputClass,
  platformOptions,
  siteStatusText,
} from "./shared";

type SiteFormFieldsProps = {
  form: SiteFormState;
  onChange: (next: SiteFormState) => void;
  includeStatus?: boolean;
  updateUrlOnPlatformChange?: boolean;
};

export function SiteFormFields({
  form,
  onChange,
  includeStatus = false,
  updateUrlOnPlatformChange = false,
}: SiteFormFieldsProps) {
  const { t } = useI18n();

  function updateField<K extends keyof SiteFormState>(key: K, value: SiteFormState[K]) {
    onChange({ ...form, [key]: value });
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <label className="grid gap-1.5 text-sm font-medium text-zinc-700">
        <span>{t("siteName")} <span className="text-red-500" aria-hidden="true">*</span></span>
        <input required type="text" value={form.name} onChange={(e) => updateField("name", e.target.value)} className={inputClass} />
      </label>
      <label className="grid gap-1.5 text-sm font-medium text-zinc-700">
        <span>{t("sitePlatform")} <span className="text-red-500" aria-hidden="true">*</span></span>
        <select
          required
          value={form.platform}
          onChange={(e) => onChange(changeSiteFormPlatform(
            form,
            e.target.value as SiteRecord["platform"],
            updateUrlOnPlatformChange,
          ))}
          className={inputClass}
        >
          {platformOptions.map((platform) => <option key={platform}>{platform}</option>)}
        </select>
      </label>
      <label className="grid gap-1.5 text-sm font-medium text-zinc-700">
        <span>{t("siteUrl")} <span className="font-normal text-zinc-400">({t("fieldOptional")})</span></span>
        <input type="text" value={form.url} onChange={(e) => updateField("url", e.target.value)} className={inputClass} />
      </label>
      <label className="grid gap-1.5 text-sm font-medium text-zinc-700">
        <span>{t("siteAccount")} <span className="font-normal text-zinc-400">({t("fieldOptional")})</span></span>
        <input type="text" value={form.account} onChange={(e) => updateField("account", e.target.value)} className={inputClass} />
      </label>
      {includeStatus ? (
        <label className="grid gap-1.5 text-sm font-medium text-zinc-700">
          <span>{t("status")}</span>
          <select value={form.status} onChange={(e) => updateField("status", e.target.value as SiteRecord["status"])} className={inputClass}>
            <option value="active">{siteStatusText.active}</option>
            <option value="paused">{siteStatusText.paused}</option>
            <option value="needs_login">{siteStatusText.needs_login}</option>
          </select>
        </label>
      ) : null}
      <label className={`grid gap-1.5 text-sm font-medium text-zinc-700 ${includeStatus ? "md:col-span-2" : "md:col-span-2"}`}>
        <span>{t("siteMemo")} <span className="font-normal text-zinc-400">({t("fieldOptional")})</span></span>
        <textarea value={form.memo} onChange={(e) => updateField("memo", e.target.value)} className={`${inputClass} min-h-24 resize-none`} />
      </label>
    </div>
  );
}
