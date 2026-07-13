import { spawnSync } from "node:child_process";

const required = ["MS_STORE_IDENTITY_NAME", "MS_STORE_PUBLISHER"] as const;
const missing = required.filter((name) => !process.env[name]?.trim());

if (process.platform !== "win32") {
  throw new Error("Microsoft Store AppX packages must be built on Windows.");
}

if (missing.length > 0) {
  throw new Error(
    `Missing ${missing.join(", ")}. Reserve the app in Partner Center, then use the exact Package/Identity values it provides.`,
  );
}

// AppX is the Electron Builder Store target. It is intentionally not given a
// WIN_CSC_* certificate: Partner Center validates the reserved identity and
// Microsoft signs the Store-distributed package after submission.
const result = spawnSync(
  "pnpm.cmd",
  [
    "exec",
    "electron-builder",
    "--win",
    "appx",
    "--publish",
    "never",
    `--config.appx.identityName=${process.env.MS_STORE_IDENTITY_NAME}`,
    `--config.appx.publisher=${process.env.MS_STORE_PUBLISHER}`,
    "--config.appx.publisherDisplayName=Meow AI Limited",
  ],
  { stdio: "inherit", env: { ...process.env, CSC_IDENTITY_AUTO_DISCOVERY: "false" } },
);

if (result.error) throw result.error;
process.exit(result.status ?? 1);
