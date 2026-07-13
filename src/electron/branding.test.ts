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

  it("keeps release signing scoped to macOS and preserves legacy local data", () => {
    const electronBuilderConfig = readProjectFile("electron-builder.yml");
    expect(electronBuilderConfig).toContain("appId: io.smepost.meowus");
    expect(electronBuilderConfig).toContain("- dmg");
    expect(electronBuilderConfig).toContain("hardenedRuntime: true");
    expect(electronBuilderConfig).not.toContain("identity: null");

    const packageJson = readProjectFile("package.json");
    expect(packageJson).toContain('"electron:build:win"');
    expect(packageJson).toContain('"electron:build:mac"');
    expect(packageJson).toContain('"electron:build:store"');

    const storeBuild = readProjectFile("scripts/build-store-package.ts");
    expect(storeBuild).toContain('"MS_STORE_IDENTITY_NAME"');
    expect(storeBuild).toContain('"MS_STORE_PUBLISHER"');
    expect(storeBuild).toContain('"appx"');
    expect(storeBuild).toContain('CSC_IDENTITY_AUTO_DISCOVERY: "false"');

    const electronMain = readProjectFile("electron/main.cjs");
    expect(electronMain).toContain('LEGACY_USER_DATA_FOLDER = "SMEPost Auto Post"');
  });
});
