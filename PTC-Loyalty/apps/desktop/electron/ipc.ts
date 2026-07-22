import { ipcMain, BrowserWindow } from "electron";
import { defaultApiBaseUrl, normalizeApiBaseUrl } from "./config";
import {
  loadSettings,
  saveSettings,
  type AppSettings,
} from "./secure-store";
import * as session from "./session";
import * as queue from "./queue";
import { pingServer } from "./api-client";
import { printReceipt, listPrinters, type ReceiptData } from "./printer";
import { quitAndInstall } from "./updater";
import type {
  PosCustomer,
  PosCustomerDetail,
  PosEarnPreview,
  PosLoginResponse,
  PosReward,
  PosTransactionResult,
  PosVoucherRedeemResult,
} from "@shared/contract";

let settings: AppSettings;

async function baseUrl(): Promise<string> {
  if (settings.apiBaseUrl) {
    try {
      return normalizeApiBaseUrl(settings.apiBaseUrl);
    } catch {
      /* fall through to default */
    }
  }
  return defaultApiBaseUrl();
}

export async function initIpc(getWindow: () => BrowserWindow | null): Promise<void> {
  settings = await loadSettings();

  // Try to restore a saved session on startup.
  await session.restore(await baseUrl()).catch(() => false);

  ipcMain.handle("pos:status", async () => ({
    authenticated: session.isAuthenticated(),
    baseUrl: await baseUrl(),
    online: session.isAuthenticated() ? true : await pingServer(await baseUrl()),
  }));

  ipcMain.handle("pos:ping", async () => pingServer(await baseUrl()));

  ipcMain.handle(
    "pos:login",
    async (_e, email: string, password: string, deviceLabel: string) => {
      const res = await session.login(await baseUrl(), email, password, deviceLabel);
      if (res.ok) return { ok: true as const, session: res.data as PosLoginResponse };
      return { ok: false as const, error: res.error, message: res.message, offline: res.offline };
    },
  );

  ipcMain.handle("pos:logout", async () => {
    await session.logout(await baseUrl());
    return { ok: true };
  });

  ipcMain.handle("pos:me", async () => {
    const res = await session.fetchSession(await baseUrl());
    return res.ok
      ? { ok: true as const, session: res.data }
      : { ok: false as const, error: res.error, message: res.message };
  });

  ipcMain.handle("pos:search", async (_e, q: string) => {
    const res = await session.authed<PosCustomer>(
      await baseUrl(),
      `/api/pos/customers/search?q=${encodeURIComponent(q)}`,
    );
    return res.ok
      ? { ok: true as const, customer: res.data }
      : { ok: false as const, error: res.error, message: res.message, offline: res.offline };
  });

  ipcMain.handle("pos:resolveQr", async (_e, token: string) => {
    const res = await session.authed<PosCustomer>(
      await baseUrl(),
      "/api/pos/customers/resolve-qr",
      { method: "POST", body: { token } },
    );
    return res.ok
      ? { ok: true as const, customer: res.data }
      : { ok: false as const, error: res.error, message: res.message, offline: res.offline };
  });

  ipcMain.handle("pos:customerDetail", async (_e, id: string) => {
    const res = await session.authed<PosCustomerDetail>(
      await baseUrl(),
      `/api/pos/customers/${encodeURIComponent(id)}`,
    );
    return res.ok
      ? { ok: true as const, detail: res.data }
      : { ok: false as const, error: res.error, message: res.message, offline: res.offline };
  });

  ipcMain.handle("pos:preview", async (_e, customerId: string, amount: number) => {
    const res = await session.authed<PosEarnPreview>(
      await baseUrl(),
      "/api/pos/transactions/preview",
      { method: "POST", body: { customerId, amount } },
    );
    return res.ok
      ? { ok: true as const, preview: res.data }
      : { ok: false as const, error: res.error, message: res.message, offline: res.offline };
  });

  ipcMain.handle(
    "pos:earn",
    async (
      _e,
      input: {
        customerId: string;
        amount: number;
        receiptRef?: string;
        idempotencyKey: string;
        branchId?: string | null;
      },
    ) => {
      const res = await session.authed<PosTransactionResult>(
        await baseUrl(),
        "/api/pos/transactions/earn",
        {
          method: "POST",
          branchId: input.branchId ?? null,
          body: {
            customerId: input.customerId,
            amount: input.amount,
            receiptRef: input.receiptRef,
            idempotencyKey: input.idempotencyKey,
            branchId: input.branchId ?? undefined,
          },
        },
      );
      return res.ok
        ? { ok: true as const, result: res.data }
        : { ok: false as const, error: res.error, message: res.message, offline: res.offline };
    },
  );

  ipcMain.handle(
    "pos:redeem",
    async (
      _e,
      input: {
        customerId: string;
        cost: number;
        rewardId?: string;
        note?: string;
        idempotencyKey: string;
        branchId?: string | null;
      },
    ) => {
      const res = await session.authed<PosTransactionResult>(
        await baseUrl(),
        "/api/pos/transactions/redeem",
        {
          method: "POST",
          branchId: input.branchId ?? null,
          body: {
            customerId: input.customerId,
            cost: input.cost,
            rewardId: input.rewardId,
            note: input.note,
            idempotencyKey: input.idempotencyKey,
            branchId: input.branchId ?? undefined,
          },
        },
      );
      return res.ok
        ? { ok: true as const, result: res.data }
        : { ok: false as const, error: res.error, message: res.message, offline: res.offline };
    },
  );

  ipcMain.handle("pos:voucherRedeem", async (_e, code: string) => {
    const res = await session.authed<PosVoucherRedeemResult>(
      await baseUrl(),
      "/api/pos/vouchers/redeem",
      { method: "POST", body: { code } },
    );
    return res.ok
      ? { ok: true as const, voucher: res.data }
      : { ok: false as const, error: res.error, message: res.message, offline: res.offline };
  });

  ipcMain.handle("pos:rewards", async () => {
    const res = await session.authed<PosReward[]>(await baseUrl(), "/api/pos/rewards");
    return res.ok
      ? { ok: true as const, rewards: res.data }
      : { ok: false as const, error: res.error, message: res.message };
  });

  // ── Settings ──────────────────────────────────────────────────────────────
  ipcMain.handle("settings:get", async () => ({
    settings,
    resolvedBaseUrl: await baseUrl(),
    defaultBaseUrl: defaultApiBaseUrl(),
  }));

  ipcMain.handle("settings:set", async (_e, patch: Partial<AppSettings>) => {
    // Validate any API URL change up front.
    if (patch.apiBaseUrl) {
      try {
        patch.apiBaseUrl = normalizeApiBaseUrl(patch.apiBaseUrl);
      } catch (e) {
        return { ok: false as const, error: e instanceof Error ? e.message : "URL không hợp lệ." };
      }
    }
    settings = { ...settings, ...patch };
    await saveSettings(settings);
    getWindow()?.setKiosk(settings.kioskMode);
    return { ok: true as const, settings };
  });

  ipcMain.handle("settings:printers", async () => listPrinters());

  // ── Offline queue ───────────────────────────────────────────────────────────
  ipcMain.handle("queue:list", async () => queue.list());
  ipcMain.handle("queue:count", async () => queue.count());
  ipcMain.handle("queue:enqueue", async (_e, item: queue.QueuedEarn) => {
    await queue.enqueue(item);
    return queue.count();
  });
  ipcMain.handle("queue:sync", async () => queue.sync(await baseUrl()));

  // ── Printing ─────────────────────────────────────────────────────────────────
  ipcMain.handle("print:receipt", async (_e, data: ReceiptData) =>
    printReceipt(data, settings.printerName),
  );

  // ── Window / kiosk ─────────────────────────────────────────────────────────
  ipcMain.handle("window:toggleFullscreen", async () => {
    const w = getWindow();
    if (w) w.setFullScreen(!w.isFullScreen());
    return w?.isFullScreen() ?? false;
  });
  ipcMain.handle("window:setKiosk", async (_e, on: boolean) => {
    getWindow()?.setKiosk(on);
    return on;
  });

  ipcMain.handle("update:install", async () => {
    quitAndInstall();
    return { ok: true };
  });
}

export function currentSettings(): AppSettings {
  return settings;
}
