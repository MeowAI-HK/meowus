import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createElectronServerRuntime } from "../src/electron/server-runtime";

const nextConfigSource = readFileSync(path.join(process.cwd(), "next.config.ts"), "utf8");

if (!nextConfigSource.includes('output: "standalone"')) {
  throw new Error("next.config.ts must use output: \"standalone\" for bundled Electron server packaging.");
}

const appDataDir = mkdtempSync(path.join(tmpdir(), "smepost-auto-post-electron-"));
const runtime = createElectronServerRuntime({ appDataDir, port: 3130 });

if (runtime.host !== "127.0.0.1") {
  throw new Error(`Electron server must bind to 127.0.0.1, received ${runtime.host}`);
}

if (runtime.env.SOCIAL_AUTO_POST_DATA_DIR !== appDataDir) {
  throw new Error("Electron runtime did not inject SOCIAL_AUTO_POST_DATA_DIR.");
}

console.log(JSON.stringify({ ok: true, url: runtime.url, appDataDir: runtime.appDataDir }));
