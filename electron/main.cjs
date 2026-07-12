const { app, BrowserWindow, dialog, Menu, Tray } = require("electron");
const { spawn } = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const net = require("node:net");
const path = require("node:path");

const PRODUCT_SHORT_NAME = "Meowus";
/** Legacy folder so existing installs keep DB/auth after productName change. */
const LEGACY_USER_DATA_FOLDER = "SMEPost Auto Post";

let serverProcess = null;
let mainWindow = null;
let tray = null;
let isQuitting = false;
let schedulerTimer = null;
const schedulerToken = crypto.randomBytes(32).toString("hex");

// Pin userData before ready so productName "Meowus" does not orphan prior data.
app.setPath("userData", path.join(app.getPath("appData"), LEGACY_USER_DATA_FOLDER));

function findStandaloneServer() {
  const candidates = [
    path.join(process.resourcesPath, "app.asar.unpacked", ".next", "standalone", "server.js"),
    path.join(process.resourcesPath, ".next", "standalone", "server.js"),
    path.join(app.getAppPath(), ".next", "standalone", "server.js"),
  ];
  const serverPath = candidates.find((candidate) => fs.existsSync(candidate));
  if (!serverPath) {
    throw new Error(`Next standalone server was not found. Checked: ${candidates.join(", ")}`);
  }
  return serverPath;
}

function findServerBootstrap() {
  const candidates = [
    path.join(app.getAppPath(), "electron", "server-bootstrap.cjs"),
    path.join(process.resourcesPath, "app.asar.unpacked", "electron", "server-bootstrap.cjs"),
    path.join(process.resourcesPath, "electron", "server-bootstrap.cjs"),
  ];
  const bootstrapPath = candidates.find((candidate) => fs.existsSync(candidate));
  if (!bootstrapPath) {
    throw new Error(`Electron server bootstrap was not found. Checked: ${candidates.join(", ")}`);
  }
  return bootstrapPath;
}

function resolveDataDir() {
  const userDataDir = path.join(app.getPath("userData"), "data");
  const portableDataDir = path.resolve(path.dirname(process.execPath), "..", "..", "web-data");
  const portableDbPath = path.join(portableDataDir, "social-auto-post.db");

  if (fs.existsSync(portableDbPath)) {
    return portableDataDir;
  }

  return userDataDir;
}

function waitForPort(port, host) {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const attempt = () => {
      const socket = net.createConnection({ host, port });
      socket.once("connect", () => {
        socket.destroy();
        resolve();
      });
      socket.once("error", () => {
        socket.destroy();
        if (Date.now() - startedAt > 30_000) {
          reject(new Error(`Timed out waiting for Next server at ${host}:${port}`));
          return;
        }
        setTimeout(attempt, 250);
      });
    };
    attempt();
  });
}

function findAvailablePort(preferredPort, host) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", (error) => {
      if (error && error.code === "EADDRINUSE") {
        findAvailablePort(0, host).then(resolve, reject);
        return;
      }
      reject(error);
    });
    server.once("listening", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : preferredPort;
      server.close(() => resolve(port));
    });
    server.listen(preferredPort, host);
  });
}

async function startServer() {
  const host = "127.0.0.1";
  const requestedPort = Number(process.env.SMEPOST_SERVER_PORT || 3130);
  const port = await findAvailablePort(Number.isFinite(requestedPort) ? requestedPort : 3130, host);
  const dataDir = resolveDataDir();
  const serverLogPath = path.join(dataDir, "electron-server.log");
  fs.mkdirSync(dataDir, { recursive: true });
  const logFd = fs.openSync(serverLogPath, "a");

  serverProcess = spawn(process.execPath, [findServerBootstrap(), findStandaloneServer()], {
    env: {
      ...process.env,
      APP_DATA_DIR: app.getPath("userData"),
      SOCIAL_AUTO_POST_DATA_DIR: dataDir,
      SOCIAL_AUTO_POST_DB_URL: `file:${path.join(dataDir, "social-auto-post.db")}`,
      SMEPOST_ELECTRON: "1",
      ELECTRON_RUN_AS_NODE: "1",
      HOSTNAME: host,
      PORT: String(port),
      SMEPOST_SCHEDULER_TOKEN: schedulerToken,
    },
    stdio: ["ignore", logFd, logFd],
    windowsHide: true,
  });

  serverProcess.once("exit", (code) => {
    if (code !== 0 && mainWindow) {
      dialog.showErrorBox(PRODUCT_SHORT_NAME, `Local server exited with code ${code ?? "unknown"}.`);
    }
  });

  await waitForPort(port, host);
  return `http://${host}:${port}`;
}

async function createWindow() {
  const baseUrl = await startServer();
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 980,
    minHeight: 680,
    title: PRODUCT_SHORT_NAME,
    icon: path.join(__dirname, "..", "build", "icon.png"),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  await mainWindow.loadURL(`${baseUrl}/zh-hk/dashboard?electron=1`);
  mainWindow.on("close", (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
  startScheduler(baseUrl);
}

function startScheduler(baseUrl) {
  if (schedulerTimer) clearTimeout(schedulerTimer);
  const poll = async () => {
    try {
      await fetch(`${baseUrl}/api/internal/scheduler/tick`, {
        method: "POST",
        headers: { authorization: `Bearer ${schedulerToken}` },
      });
    } catch (error) {
      console.error("[scheduler] tick failed", error);
    } finally {
      if (!isQuitting) schedulerTimer = setTimeout(poll, 10_000);
    }
  };
  schedulerTimer = setTimeout(poll, 1_000);
}

function createTray() {
  tray = new Tray(path.join(__dirname, "..", "build", "icon.png"));
  tray.setToolTip(`${PRODUCT_SHORT_NAME} — schedules run while this tray icon is active`);
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: `Open ${PRODUCT_SHORT_NAME}`, click: () => { mainWindow?.show(); mainWindow?.focus(); } },
    { type: "separator" },
    { label: "Quit", click: () => { isQuitting = true; app.quit(); } },
  ]));
  tray.on("double-click", () => { mainWindow?.show(); mainWindow?.focus(); });
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  createTray();
  createWindow().catch((error) => {
    dialog.showErrorBox(PRODUCT_SHORT_NAME, error instanceof Error ? error.message : String(error));
    app.quit();
  });
});

app.on("window-all-closed", () => {
  // Keep the local server and scheduler alive in the Windows tray.
});

app.on("before-quit", () => {
  isQuitting = true;
  if (schedulerTimer) clearTimeout(schedulerTimer);
  if (serverProcess && !serverProcess.killed) {
    serverProcess.kill();
  }
});
