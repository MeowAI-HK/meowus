import path from "node:path";
import { SMEPOST_APP_NAME } from "@/features/smepost/constants";

export type RuntimeMode = "development" | "packaged";

export function runtimeMode(): RuntimeMode {
  return process.env.ELECTRON_RUN_AS_NODE || process.env.SMEPOST_ELECTRON === "1"
    ? "packaged"
    : "development";
}

export function resolveAppDataDir() {
  if (process.env.SOCIAL_AUTO_POST_DATA_DIR) {
    return path.resolve(process.env.SOCIAL_AUTO_POST_DATA_DIR);
  }
  if (process.env.APP_DATA_DIR) {
    return path.resolve(process.env.APP_DATA_DIR, SMEPOST_APP_NAME);
  }
  return path.join(/*turbopackIgnore: true*/ process.cwd(), "web-data");
}

export function resolveServerHost() {
  return process.env.SMEPOST_SERVER_HOST || "127.0.0.1";
}

export function resolveServerPort() {
  const raw = Number(process.env.PORT || process.env.SMEPOST_SERVER_PORT || 3000);
  return Number.isInteger(raw) && raw > 0 ? raw : 3000;
}
