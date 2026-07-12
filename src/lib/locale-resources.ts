import en from "../locales/en.json";
import zhHk from "../locales/zh-hk.json";
import { defaultLocale, isLocale, type Locale } from "./i18n-config";

export const localeResources = {
  en,
  "zh-hk": zhHk,
} satisfies Record<Locale, typeof en>;

export type LocaleDictionary = typeof en;
export type TranslationKey = keyof LocaleDictionary;

export async function getLocaleResource(locale: Locale): Promise<LocaleDictionary> {
  return localeResources[locale] ?? localeResources[defaultLocale];
}

export function normalizeLocale(value: string | undefined): Locale {
  return isLocale(value) ? value : defaultLocale;
}
