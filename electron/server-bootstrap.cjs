const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");

const serverPath = process.argv[2];

if (!serverPath) {
  throw new Error("Missing Next standalone server path.");
}

const standaloneRoot = path.dirname(serverPath);
const pnpmRoot = path.join(standaloneRoot, "node_modules", ".pnpm");
const modulePaths = [path.join(standaloneRoot, "node_modules")];

if (fs.existsSync(pnpmRoot)) {
  for (const entry of fs.readdirSync(pnpmRoot)) {
    const nodeModulesPath = path.join(pnpmRoot, entry, "node_modules");
    if (fs.existsSync(nodeModulesPath)) {
      modulePaths.push(nodeModulesPath);
    }
  }
}

process.env.NODE_PATH = [
  ...modulePaths,
  process.env.NODE_PATH,
].filter(Boolean).join(path.delimiter);

Module._initPaths();

require(serverPath);
