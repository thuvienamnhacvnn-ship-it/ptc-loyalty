import type { PosErrorBody } from "@shared/contract";

// ─────────────────────────────────────────────────────────────────────────────
// HTTP client used by the Electron MAIN process only. The renderer never makes
// network calls directly — it goes through IPC — so tokens stay in the main
// process and CORS is a non-issue.
//
// TLS: we use Node's global fetch with default certificate validation. We NEVER
// set NODE_TLS_REJECT_UNAUTHORIZED=0 or otherwise bypass certificate errors.
// ─────────────────────────────────────────────────────────────────────────────

export type ApiResult<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; error: string; message: string; offline?: boolean };

export interface RequestOptions {
  method?: "GET" | "POST";
  token?: string | null;
  body?: unknown;
  branchId?: string | null;
  timeoutMs?: number;
}

export async function apiRequest<T>(
  baseUrl: string,
  path: string,
  opts: RequestOptions = {},
): Promise<ApiResult<T>> {
  const { method = "GET", token, body, branchId, timeoutMs = 15000 } = opts;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const headers: Record<string, string> = { Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (branchId) headers["X-Branch-Id"] = branchId;
  if (body !== undefined) headers["Content-Type"] = "application/json";

  try {
    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
      redirect: "manual",
    });

    const text = await res.text();
    let json: unknown = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }

    if (res.ok) {
      return { ok: true, status: res.status, data: json as T };
    }
    const err = (json ?? {}) as Partial<PosErrorBody>;
    return {
      ok: false,
      status: res.status,
      error: err.error ?? "server_error",
      message: err.message ?? "Lỗi máy chủ. Vui lòng thử lại.",
    };
  } catch (e) {
    // Distinguish a genuine network/offline failure from an HTTP error so the
    // UI can offer the offline queue instead of falsely reporting success.
    const aborted = e instanceof Error && e.name === "AbortError";
    return {
      ok: false,
      status: 0,
      error: aborted ? "timeout" : "offline",
      message: aborted
        ? "Máy chủ phản hồi quá lâu."
        : "Không có kết nối tới máy chủ.",
      offline: true,
    };
  } finally {
    clearTimeout(timer);
  }
}

/** Lightweight connectivity probe against the POS ping endpoint. */
export async function pingServer(baseUrl: string): Promise<boolean> {
  const r = await apiRequest<{ ok: boolean }>(baseUrl, "/api/pos/ping", {
    timeoutMs: 6000,
  });
  return r.ok;
}
