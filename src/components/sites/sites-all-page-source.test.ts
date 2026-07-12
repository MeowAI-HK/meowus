import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const pageSource = fs.readFileSync(
  path.join(process.cwd(), "src", "app", "[locale]", "(console)", "sites", "all", "page.tsx"),
  "utf8",
);

describe("sites all browser cards", () => {
  it("shows an explicit open Chrome button in the waiting preview state", () => {
    expect(pageSource).toContain('type MouseEvent');
    expect(pageSource).toContain('event.stopPropagation()');
    expect(pageSource).toContain('{t("openChrome")}');
    expect(pageSource).toContain('onClick={(event) => void openSiteChrome(event, site)}');
  });
});
