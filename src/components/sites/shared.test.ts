import { describe, expect, it } from "vitest";
import {
  changeSiteFormPlatform,
  createEmptySiteForm,
  defaultUrlForPlatform,
  platformOptions,
} from "./shared";

describe("site platform defaults", () => {
  it("provides a URL default for every platform", () => {
    for (const platform of platformOptions) {
      expect(defaultUrlForPlatform(platform)).toBeTypeOf("string");
    }
    expect(defaultUrlForPlatform("Threads")).toBe("https://www.threads.com/");
    expect(defaultUrlForPlatform("Other")).toBe("");
  });

  it("updates the URL for the add-site flow", () => {
    const form = { ...createEmptySiteForm(), url: "https://custom.example/" };
    expect(changeSiteFormPlatform(form, "Instagram", true)).toMatchObject({
      platform: "Instagram",
      url: "https://www.instagram.com/",
    });
  });

  it("preserves a custom URL while editing an existing site", () => {
    const form = { ...createEmptySiteForm(), url: "https://custom.example/" };
    expect(changeSiteFormPlatform(form, "LinkedIn", false)).toMatchObject({
      platform: "LinkedIn",
      url: "https://custom.example/",
    });
  });
});
