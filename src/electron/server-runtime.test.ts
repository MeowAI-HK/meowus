import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createElectronServerRuntime, resolveElectronAppDataDir } from "./server-runtime";

describe("Electron server runtime", () => {
  it("binds packaged Next server to localhost and injects app data env", () => {
    const runtime = createElectronServerRuntime({
      appDataDir: "C:/Users/example/AppData/Roaming/SMEPost Auto Post",
      port: 3130,
      baseEnv: { NODE_ENV: "test" },
    });

    expect(runtime.host).toBe("127.0.0.1");
    expect(runtime.url).toBe("http://127.0.0.1:3130");
    expect(runtime.env.SOCIAL_AUTO_POST_DATA_DIR).toBe(runtime.appDataDir);
    expect(runtime.env.SMEPOST_ELECTRON).toBe("1");
    expect(runtime.env.ELECTRON_RUN_AS_NODE).toBe("1");
  });

  it("prefers portable workspace web-data when the packaged app is launched beside a populated repo", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "smepost-electron-data-"));
    const executableDir = path.join(root, "dist-electron", "win-unpacked");
    const portableDataDir = path.join(root, "web-data");
    const userDataDir = path.join(root, "user-data");

    fs.mkdirSync(executableDir, { recursive: true });
    fs.mkdirSync(portableDataDir, { recursive: true });
    fs.writeFileSync(path.join(portableDataDir, "social-auto-post.db"), "");

    expect(resolveElectronAppDataDir({ userDataDir, executableDir })).toBe(portableDataDir);
  });
});
