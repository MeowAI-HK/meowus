import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Providers } from "@/app/providers";
import { getLocaleResource } from "@/lib/locale-resources";
import { isLocale, locales, localizedPath, type Locale } from "@/lib/i18n-config";
import {
  PRODUCT_DESCRIPTOR_EN,
  PRODUCT_DESCRIPTOR_ZH_HK,
  PRODUCT_SHORT_NAME,
} from "@/lib/product-branding";

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = isLocale(rawLocale) ? rawLocale : "zh-hk";
  const isEnglish = locale === "en";

  return {
    title: PRODUCT_SHORT_NAME,
    description: isEnglish ? PRODUCT_DESCRIPTOR_EN : PRODUCT_DESCRIPTOR_ZH_HK,
    alternates: {
      canonical: localizedPath(locale, "/dashboard"),
      languages: {
        en: localizedPath("en", "/dashboard"),
        "zh-HK": localizedPath("zh-hk", "/dashboard"),
      },
    },
    robots: {
      index: false,
      follow: false,
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  if (!isLocale(rawLocale)) notFound();

  const locale: Locale = rawLocale;
  const dictionary = await getLocaleResource(locale);

  return (
    <Providers dictionary={dictionary} locale={locale}>
      {children}
    </Providers>
  );
}
