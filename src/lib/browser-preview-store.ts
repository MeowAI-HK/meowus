import {
  markClosed,
  type BrowserPreviewSession,
  type BrowserPreviewStore,
} from "./browser-preview-shared";

declare global {
  var __browserPreviewStore__: BrowserPreviewStore | undefined;
}

export function getBrowserPreviewStore() {
  globalThis.__browserPreviewStore__ ??= {
    sessions: new Map<string, BrowserPreviewSession>(),
    starting: new Map(),
    cleanupRegistered: false,
  };
  installProcessCleanup();
  return globalThis.__browserPreviewStore__;
}

export async function closeBrowserPreviewSessionContext(session: BrowserPreviewSession) {
  const context = session.context;
  markClosed(session);
  await context?.close().catch(() => undefined);
}

async function closeAllBrowserPreviewSessions() {
  const store = getBrowserPreviewStore();
  const sessions = [...store.sessions.entries()];

  store.starting.clear();

  await Promise.all(
    sessions.map(async ([siteId, session]) => {
      await closeBrowserPreviewSessionContext(session);
      store.sessions.delete(siteId);
    }),
  );
}

function installProcessCleanup() {
  const store = globalThis.__browserPreviewStore__;
  if (!store || store.cleanupRegistered || typeof process === "undefined") {
    return;
  }

  store.cleanupRegistered = true;

  const cleanup = () => {
    store.cleanupPromise ??= closeAllBrowserPreviewSessions().catch(() => undefined);
    return store.cleanupPromise;
  };

  const forwardSignal = (signal: NodeJS.Signals) => {
    void cleanup().finally(() => {
      process.kill(process.pid, signal);
    });
  };

  process.once("beforeExit", () => {
    void cleanup();
  });
  process.once("SIGINT", () => {
    forwardSignal("SIGINT");
  });
  process.once("SIGTERM", () => {
    forwardSignal("SIGTERM");
  });
}
