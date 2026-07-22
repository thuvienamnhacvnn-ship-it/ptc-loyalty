import { apiRequest, type ApiResult } from "./api-client";
import {
  saveRefreshToken,
  loadRefreshToken,
  clearRefreshToken,
} from "./secure-store";
import type {
  PosLoginResponse,
  PosRefreshResponse,
  PosSessionInfo,
} from "@shared/contract";

// ─────────────────────────────────────────────────────────────────────────────
// Session manager (main process). Holds the short-lived access token in memory
// only; persists the rotating refresh token via DPAPI-encrypted secure storage.
// Transparently refreshes the access token on 401 and retries once.
// ─────────────────────────────────────────────────────────────────────────────

let accessToken: string | null = null;
let accessExpiresAt = 0;
let refreshToken: string | null = null;

export function isAuthenticated(): boolean {
  return !!refreshToken;
}

export function getAccessToken(): string | null {
  return accessToken;
}

function setTokens(t: {
  accessToken: string;
  accessExpiresAt: number;
  refreshToken: string;
}) {
  accessToken = t.accessToken;
  accessExpiresAt = t.accessExpiresAt;
  refreshToken = t.refreshToken;
}

export async function login(
  baseUrl: string,
  email: string,
  password: string,
  deviceLabel: string,
): Promise<ApiResult<PosLoginResponse>> {
  const res = await apiRequest<PosLoginResponse>(baseUrl, "/api/pos/auth/login", {
    method: "POST",
    body: { email, password, deviceLabel },
  });
  if (res.ok) {
    setTokens(res.data);
    await saveRefreshToken(res.data.refreshToken);
  }
  return res;
}

/** Restore a session from the encrypted refresh token on app startup. */
export async function restore(baseUrl: string): Promise<boolean> {
  const stored = await loadRefreshToken();
  if (!stored) return false;
  refreshToken = stored;
  const ok = await refreshAccess(baseUrl);
  return ok;
}

async function refreshAccess(baseUrl: string): Promise<boolean> {
  if (!refreshToken) return false;
  const res = await apiRequest<PosRefreshResponse>(
    baseUrl,
    "/api/pos/auth/refresh",
    { method: "POST", body: { refreshToken } },
  );
  if (!res.ok) {
    if (res.status === 401) await logoutLocal();
    return false;
  }
  setTokens(res.data);
  await saveRefreshToken(res.data.refreshToken);
  return true;
}

async function logoutLocal(): Promise<void> {
  accessToken = null;
  accessExpiresAt = 0;
  refreshToken = null;
  await clearRefreshToken();
}

export async function logout(baseUrl: string): Promise<void> {
  if (refreshToken) {
    await apiRequest(baseUrl, "/api/pos/auth/logout", {
      method: "POST",
      body: { refreshToken },
    }).catch(() => undefined);
  }
  await logoutLocal();
}

/**
 * Perform an authenticated request, auto-refreshing the access token once on
 * expiry or a 401. Refresh a bit early to avoid a guaranteed round-trip.
 */
export async function authed<T>(
  baseUrl: string,
  path: string,
  opts: { method?: "GET" | "POST"; body?: unknown; branchId?: string | null } = {},
): Promise<ApiResult<T>> {
  if (!accessToken || Date.now() > accessExpiresAt - 30_000) {
    await refreshAccess(baseUrl);
  }
  let res = await apiRequest<T>(baseUrl, path, { ...opts, token: accessToken });
  if (!res.ok && res.status === 401) {
    const refreshed = await refreshAccess(baseUrl);
    if (refreshed) {
      res = await apiRequest<T>(baseUrl, path, { ...opts, token: accessToken });
    }
  }
  return res;
}

export async function fetchSession(
  baseUrl: string,
): Promise<ApiResult<PosSessionInfo>> {
  return authed<PosSessionInfo>(baseUrl, "/api/pos/me");
}
