import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function readProjectFile(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

describe("Electron and web branding", () => {
  it("uses the rocket brand logo for app and website icons", () => {
    const iconGenerator = readProjectFile("scripts/generate-icons.ts");
    expect(iconGenerator).toContain('path.join(root, "public", "logo.webp")');
    expect(iconGenerator).toContain('path.join(root, "public", "favicon.ico")');
    expect(iconGenerator).toContain('path.join(buildDir, "icon.ico")');
    expect(iconGenerator).toContain('path.join(buildDir, "icon.png")');

    const packageJson = readProjectFile("package.json");
    expect(packageJson).toContain('"build": "pnpm icons:generate && next build"');

    const rootLayout = readProjectFile("src/app/layout.tsx");
    expect(rootLayout).toContain('icon: "/favicon.ico"');

    const electronBuilderConfig = readProjectFile("electron-builder.yml");
    expect(electronBuilderConfig).toContain("icon: build/icon.ico");

    const electronMain = readProjectFile("electron/main.cjs");
    expect(electronMain).toContain('icon: path.join(__dirname, "..", "build", "icon.png")');
  });

  it("disables the default Electron menu that exposes developer tools", () => {
    const electronMain = readProjectFile("electron/main.cjs");
    expect(electronMain).toContain("Menu.setApplicationMenu(null)");
  });
});
