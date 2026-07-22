import { app, safeStorage } from "electron";
import { promises as fs } from "node:fs";
import path from "node:path";

// ─────────────────────────────────────────────────────────────────────────────
// Encrypted-at-rest storage for the desktop client.
//
//   • Secrets (refresh token, offline queue) are encrypted with Electron
//     `safeStorage`, which on Windows uses DPAPI (per-user, per-machine). The
//     ciphertext is written to the app's userData folder. Raw tokens are NEVER
//     written to localStorage or plaintext files.
//   • Non-secret settings (apiBaseUrl, cameraId, printerName, kioskMode) are
//     stored as plain JSON — they contain no credentials.
// ─────────────────────────────────────────────────────────────────────────────

function filePath(name: string): string {
  return path.join(app.getPath("userData"), name);
}

const SECRET_FILE = "session.enc";
const SETTINGS_FILE = "settings.json";
const QUEUE_FILE = "queue.enc";

async function writeEncrypted(file: string, value: string): Promise<void> {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error("OS secure storage (DPAPI) không khả dụng.");
  }
  const buf = safeStorage.encryptString(value);
  await fs.writeFile(filePath(file), buf);
}

async function readEncrypted(file: string): Promise<string | null> {
  try {
    const buf = await fs.readFile(filePath(file));
    if (!safeStorage.isEncryptionAvailable()) return null;
    return safeStorage.decryptString(buf);
  } catch {
    return null;
  }
}

async function removeFile(file: string): Promise<void> {
  await fs.rm(filePath(file), { force: true }).catch(() => undefined);
}

// ── Refresh token (the only long-lived secret) ───────────────────────────────

export async function saveRefreshToken(token: string): Promise<void> {
  await writeEncrypted(SECRET_FILE, token);
}

export async function loadRefreshToken(): Promise<string | null> {
  return readEncrypted(SECRET_FILE);
}

export async function clearRefreshToken(): Promise<void> {
  await removeFile(SECRET_FILE);
}

// ── Settings (non-secret) ────────────────────────────────────────────────────

export interface AppSettings {
  apiBaseUrl: string | null; // null → use built-in default
  cameraId: string | null;
  printerName: string | null; // null → system default printer
  kioskMode: boolean;
  autoPrintReceipt: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  apiBaseUrl: null,
  cameraId: null,
  printerName: null,
  kioskMode: false,
  autoPrintReceipt: false,
};

export async function loadSettings(): Promise<AppSettings> {
  try {
    const raw = await fs.readFile(filePath(SETTINGS_FILE), "utf8");
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await fs.writeFile(filePath(SETTINGS_FILE), JSON.stringify(settings, null, 2));
}

// ── Encrypted offline queue ──────────────────────────────────────────────────

export async function saveQueueRaw(json: string): Promise<void> {
  await writeEncrypted(QUEUE_FILE, json);
}

export async function loadQueueRaw(): Promise<string | null> {
  return readEncrypted(QUEUE_FILE);
}
