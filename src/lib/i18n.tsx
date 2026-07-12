"use client";

import React, { createContext, useContext } from "react";
import type { LocaleDictionary, TranslationKey } from "./locale-resources";
import type { Locale } from "./i18n-config";

type I18nContextProps = {
  locale: Locale;
  dictionary: LocaleDictionary;
  t: (key: TranslationKey, values?: Record<string, string | number>) => string;
};

const I18nContext = createContext<I18nContextProps | undefined>(undefined);

function interpolate(text: string, values?: Record<string, string | number>) {
  if (!values) return text;
  return Object.entries(values).reduce(
    (next, [name, value]) => next.replaceAll(`{${name}}`, String(value)),
    text,
  );
}

export function I18nProvider({
  children,
  dictionary,
  locale,
}: {
  children: React.ReactNode;
  dictionary: LocaleDictionary;
  locale: Locale;
}) {
  const value = React.useMemo<I18nContextProps>(
    () => ({
      locale,
      dictionary,
      t: (key, values) => interpolate(dictionary[key] ?? key, values),
    }),
    [dictionary, locale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within an I18nProvider");
  }
  return context;
}

export type { Locale } from "./i18n-config";
