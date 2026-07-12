import { describe, expect, it } from "vitest";
import { localeResources } from "./locale-resources";
import { localeLabel, locales } from "./i18n-config";

const mojibakePattern = /\uFFFD|嚙|蝜|銝|皜|嚗|隤|撌|憭/;

describe("i18n coverage", () => {
  it("keeps all locale resources aligned", () => {
    const englishKeys = Object.keys(localeResources.en).sort();
    for (const locale of locales) {
      expect(Object.keys(localeResources[locale]).sort()).toEqual(englishKeys);
    }
  });

  it("does not expose mojibake in locale labels", () => {
    for (const locale of locales) {
      expect(localeLabel(locale)).not.toMatch(mojibakePattern);
    }
  });

  it("does not expose mojibake in active zh-hk locale values", () => {
    const broken = Object.entries(localeResources["zh-hk"]).filter(([, value]) => mojibakePattern.test(value));
    expect(broken).toEqual([]);
  });
});
