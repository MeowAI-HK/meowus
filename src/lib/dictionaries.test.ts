import { describe, expect, it } from "vitest";
import { localeResources } from "./locale-resources";
import { locales } from "./i18n-config";

describe("locale resources", () => {
  it("has matching keys for every supported locale", () => {
    const expectedKeys = Object.keys(localeResources.en).sort();
    for (const locale of locales) {
      expect(Object.keys(localeResources[locale]).sort()).toEqual(expectedKeys);
    }
  });

  it("does not contain empty or visibly corrupted text", () => {
    for (const locale of locales) {
      for (const [key, value] of Object.entries(localeResources[locale])) {
        expect(value, `${locale}.${key}`).not.toHaveLength(0);
        expect(value, `${locale}.${key}`).not.toMatch(/\uFFFD|嚙罵??洱?院???/);
      }
    }
  });
});
