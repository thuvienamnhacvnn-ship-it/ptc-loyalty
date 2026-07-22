import { app, BrowserWindow } from "electron";
// electron-updater is CommonJS and exposes `autoUpdater` as a NAMED export.
// A default import + destructure (`import pkg from ...; const { autoUpdater } = pkg`)
// breaks under the CJS bundle because there is no `.default` — use the named
// import so esbuild emits `require("electron-updater").autoUpdater`.
import { autoUpdater } from "electron-updater";

// ─────────────────────────────────────────────────────────────────────────────
// Auto-update via electron-updater. Only active in packaged production builds;
// in dev it is a no-op so developers are never prompted. The update feed is
// configured in electron-builder.yml (`publish`).
// ─────────────────────────────────────────────────────────────────────────────

export function initAutoUpdate(getWindow: () => BrowserWindow | null): void {
  if (!app.isPackaged) return;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  const send = (channel: string, payload?: unknown) => {
    getWindow()?.webContents.send(channel, payload);
  };

  autoUpdater.on("update-available", (info) =>
    send("update:available", { version: info.version }),
  );
  autoUpdater.on("download-progress", (p) =>
    send("update:progress", { percent: Math.round(p.percent) }),
  );
  autoUpdater.on("update-downloaded", (info) =>
    send("update:ready", { version: info.version }),
  );
  autoUpdater.on("error", (err) =>
    send("update:error", { message: err?.message ?? String(err) }),
  );

  autoUpdater.checkForUpdates().catch(() => undefined);
  // Re-check every 6 hours while the app stays open at the counter.
  setInterval(() => autoUpdater.checkForUpdates().catch(() => undefined), 6 * 60 * 60 * 1000);
}

export function quitAndInstall(): void {
  if (app.isPackaged) autoUpdater.quitAndInstall();
}
