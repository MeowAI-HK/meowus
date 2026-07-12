import path from "node:path";
import { mkdirSync } from "node:fs";
import { resolveAppDataDir } from "@/lib/runtime-config";

export function appRoot() {
  return process.cwd();
}

export function dataRoot() {
  const root = resolveAppDataDir();
  mkdirSync(root, { recursive: true });
  return root;
}

export function browserProfilesRoot() {
  const root = path.join(dataRoot(), "browser-profiles");
  mkdirSync(root, { recursive: true });
  return root;
}

export function uploadsRoot() {
  const root = path.join(dataRoot(), "uploads");
  mkdirSync(root, { recursive: true });
  return root;
}

export function artifactsRoot() {
  const root = path.join(dataRoot(), "artifacts");
  mkdirSync(root, { recursive: true });
  return root;
}

export function normalizeFileUrl(fileUrl: string) {
  if (!fileUrl.startsWith("file:")) {
    return fileUrl;
  }
  const value = fileUrl.slice("file:".length);
  const resolved = path.isAbsolute(value)
    ? value
    : path.resolve(/*turbopackIgnore: true*/ process.cwd(), value);
  return `file:${resolved.replace(/\\/g, "/")}`;
}
