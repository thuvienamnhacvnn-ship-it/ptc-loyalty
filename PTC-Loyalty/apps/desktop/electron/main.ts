import { app, BrowserWindow, session as electronSession } from "electron";
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

  // Grant camera permission to our own content only (for the QR scanner).
  electronSession.defaultSession.setPermissionRequestHandler(
    (_wc, permission, callback) => {
      callback(permission === "media");
    },
  );

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
