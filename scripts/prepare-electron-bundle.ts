import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const standaloneRoot = path.join(root, ".next", "standalone");

if (!existsSync(path.join(standaloneRoot, "server.js"))) {
  throw new Error("Missing .next/standalone/server.js. Run next build before preparing Electron bundle.");
}

function copyIntoStandalone(source: string, target: string) {
  if (!existsSync(source)) return;
  rmSync(target, { recursive: true, force: true });
  mkdirSync(path.dirname(target), { recursive: true });
  cpSync(source, target, { recursive: true });
}

function ensureExternalPackageShims() {
  const serverChunksDir = path.join(standaloneRoot, ".next", "server", "chunks");
  if (!existsSync(serverChunksDir)) return;

  const aliasNames = new Set<string>();
  const queue = [serverChunksDir];

  while (queue.length > 0) {
    const currentDir = queue.pop();
    if (!currentDir) continue;

    for (const entry of readdirSync(currentDir, { withFileTypes: true })) {
      const entryPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        queue.push(entryPath);
        continue;
      }
      if (!entry.isFile() || !entry.name.endsWith(".js")) continue;

      const source = readFileSync(entryPath, "utf8");
      for (const match of source.matchAll(/(?:@[^/"\\\s]+\/[^/"\\\s]+|[a-z0-9._-]+)-[a-f0-9]{16,}/gi)) {
        aliasNames.add(match[0]);
      }
    }
  }

  for (const aliasName of aliasNames) {
    const basePackageName = aliasName.replace(/-[a-f0-9]{16,}$/i, "");
    const basePackageDir = path.join(standaloneRoot, "node_modules", ...basePackageName.split("/"));
    if (!existsSync(basePackageDir)) continue;

    const shimDir = path.join(standaloneRoot, "node_modules", aliasName);
    mkdirSync(shimDir, { recursive: true });
    writeFileSync(
      path.join(shimDir, "package.json"),
      JSON.stringify({
        name: aliasName,
        private: true,
        main: "index.js",
      }, null, 2),
    );
    writeFileSync(
      path.join(shimDir, "index.js"),
      `module.exports = require(${JSON.stringify(basePackageName)});\n`,
    );
  }
}

copyIntoStandalone(path.join(root, ".next", "static"), path.join(standaloneRoot, ".next", "static"));
copyIntoStandalone(path.join(root, "public"), path.join(standaloneRoot, "public"));
copyIntoStandalone(path.join(root, "node_modules", "playwright"), path.join(standaloneRoot, "node_modules", "playwright"));
copyIntoStandalone(path.join(root, "node_modules", "playwright-core"), path.join(standaloneRoot, "node_modules", "playwright-core"));
copyIntoStandalone(path.join(root, "node_modules", ".pnpm", "playwright@1.60.0"), path.join(standaloneRoot, "node_modules", ".pnpm", "playwright@1.60.0"));
copyIntoStandalone(path.join(root, "node_modules", ".pnpm", "playwright-core@1.59.1"), path.join(standaloneRoot, "node_modules", ".pnpm", "playwright-core@1.59.1"));
copyIntoStandalone(path.join(root, "node_modules", ".pnpm", "playwright-core@1.60.0"), path.join(standaloneRoot, "node_modules", ".pnpm", "playwright-core@1.60.0"));
ensureExternalPackageShims();

for (const runtimeFolder of ["web-data", ".playwright-cli", "playwright-report", "test-results"]) {
  rmSync(path.join(standaloneRoot, runtimeFolder), { recursive: true, force: true });
}

console.log("Prepared Electron standalone bundle.");
