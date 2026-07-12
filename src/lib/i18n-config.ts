export const locales = ["zh-hk", "en"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "zh-hk";

export function isLocale(value: string | undefined): value is Locale {
  return typeof value === "string" && locales.includes(value as Locale);
}

export function localeLabel(locale: Locale) {
  return locale === "zh-hk" ? "繁體中文 (香港)" : "English";
}

export function stripLocale(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);
  if (isLocale(segments[0])) {
    return `/${segments.slice(1).join("/")}` || "/";
  }
  return pathname || "/";
}

export function localizedPath(locale: Locale, href: string) {
  if (!href.startsWith("/")) return href;
  const [path, query = ""] = href.split("?");
  const cleanPath = stripLocale(path);
  return `/${locale}${cleanPath === "/" ? "" : cleanPath}${query ? `?${query}` : ""}`;
}
