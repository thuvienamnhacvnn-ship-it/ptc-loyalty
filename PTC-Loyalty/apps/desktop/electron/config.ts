import { app } from "electron";

// ─────────────────────────────────────────────────────────────────────────────
// API endpoint configuration.
//
//   Development  → the local webapp (default http://localhost:4000).
//   Production   → the platform's official HTTPS domain.
//
// Precedence (first wins):
//   1. User override saved in Settings (settings.apiBaseUrl)
//   2. POS_API_BASE_URL environment variable
//   3. Built-in default chosen by app.isPackaged
// ─────────────────────────────────────────────────────────────────────────────

const DEV_DEFAULT = "http://localhost:4000";
// TODO: set this to the real production domain before shipping installers.
const PROD_DEFAULT = "https://app.ptc-loyalty.example";

export function defaultApiBaseUrl(): string {
  if (process.env.POS_API_BASE_URL) return process.env.POS_API_BASE_URL;
  return app.isPackaged ? PROD_DEFAULT : DEV_DEFAULT;
}

/** Normalize and validate a base URL. Enforces HTTPS except for localhost. */
export function normalizeApiBaseUrl(raw: string): string {
  const url = new URL(raw.trim());
  const isLocal =
    url.hostname === "localhost" ||
    url.hostname === "127.0.0.1" ||
    url.hostname === "::1";
  if (url.protocol !== "https:" && !isLocal) {
    throw new Error("API server phải dùng HTTPS (chỉ localhost mới cho phép HTTP).");
  }
  // strip trailing slash
  return url.origin + url.pathname.replace(/\/+$/, "");
}

export const IS_DEV = !app.isPackaged;
