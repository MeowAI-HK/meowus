import path from "node:path";
import fs from "node:fs";

export type ElectronServerRuntime = {
  host: string;
  port: number;
  appDataDir: string;
  env: NodeJS.ProcessEnv;
  url: string;
};

export function resolveElectronAppDataDir(input: {
  userDataDir: string;
  executableDir?: string;
}) {
  const userDataDir = path.resolve(input.userDataDir);
  const executableDir = input.executableDir ? path.resolve(input.executableDir) : "";
  const portableDataDir = executableDir
    ? path.resolve(executableDir, "..", "..", "web-data")
    : "";

  if (portableDataDir && fs.existsSync(path.join(portableDataDir, "social-auto-post.db"))) {
    return portableDataDir;
  }

  return userDataDir;
}

export function createElectronServerRuntime(input: {
  appDataDir: string;
  port?: number;
  host?: string;
  baseEnv?: NodeJS.ProcessEnv;
}): ElectronServerRuntime {
  const host = input.host || "127.0.0.1";
  const port = input.port && input.port > 0 ? input.port : 0;
  const appDataDir = path.resolve(input.appDataDir);
  const env = {
    ...(input.baseEnv ?? process.env),
    APP_DATA_DIR: appDataDir,
    SOCIAL_AUTO_POST_DATA_DIR: appDataDir,
    SMEPOST_API_BASE_URL: (input.baseEnv ?? process.env).SMEPOST_API_BASE_URL || "https://smepost.io",
    SMEPOST_ELECTRON: "1",
    ELECTRON_RUN_AS_NODE: "1",
    HOSTNAME: host,
    PORT: String(port),
  };

  return {
    host,
    port,
    appDataDir,
    env,
    url: `http://${host}:${port}`,
  };
}
