import {
  app,
  BrowserWindow,
  session as electronSession,
  systemPreferences,
} from "electron";
import path from "node:path";
import { initIpc, currentSettings } from "./ipc";
import { initAutoUpdate } from "./updater";

// Single instance — a counter should only run one till window.
if (!app.requestSingleInstanceLock()) {
  app.quit();
}

let mainWindow: BrowserWindow | null = null;
const getWindow = () => mainWindow;

const DEV_URL = process.env.VITE_DEV_SERVER_URL;

function createWindow(): void {
  const kiosk = currentSettings().kioskMode;
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: "#0b1220",
    kiosk,
    autoHideMenuBar: true,
    title: "PTC Loyalty Kasse",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  // Camera access for the QR scanner (incl. USB webcams). Electron needs BOTH:
  //  - the async request handler (first getUserMedia prompt), and
  //  - the sync check handler (subsequent access + enumerateDevices) — without
  //    the check handler the camera is often denied *silently*.
  const ses = electronSession.defaultSession;
  ses.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(permission === "media");
  });
  ses.setPermissionCheckHandler((_wc, permission) => permission === "media");
  // Allow the renderer to bind to a specific video input device (USB camera).
  ses.setDevicePermissionHandler(() => true);

  if (DEV_URL) {
    mainWindow.loadURL(DEV_URL);
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  // Obtain OS-level camera permission up front (macOS prompts; Windows/Linux
  // report status). Never blocks startup if it fails.
  try {
    if (
      process.platform === "darwin" &&
      typeof systemPreferences.askForMediaAccess === "function"
    ) {
      await systemPreferences.askForMediaAccess("camera");
    } else if (typeof systemPreferences.getMediaAccessStatus === "function") {
      const status = systemPreferences.getMediaAccessStatus("camera");
      if (status !== "granted") {
        // eslint-disable-next-line no-console
        console.warn(`[camera] OS media-access status: ${status}`);
      }
    }
  } catch {
    /* ignore — getUserMedia will still prompt/degrade gracefully */
  }

  await initIpc(getWindow);
  createWindow();
  initAutoUpdate(getWindow);

  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
