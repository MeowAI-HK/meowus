"use client";

import type { LocaleDictionary } from "@/lib/locale-resources";
import { I18nProvider } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n-config";

export function Providers({
  children,
  dictionary,
  locale,
}: {
  children: React.ReactNode;
  dictionary: LocaleDictionary;
  locale: Locale;
}) {
  return (
    <I18nProvider dictionary={dictionary} locale={locale}>
      {children}
    </I18nProvider>
  );
}
