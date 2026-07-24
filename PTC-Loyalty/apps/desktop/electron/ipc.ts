import { ipcMain, BrowserWindow, clipboard, nativeImage, shell, dialog } from "electron";
import { writeFile } from "node:fs/promises";
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
  PosStats,
  PosTransactionListItem,
  PosTransactionResult,
  PosVoucherRedeemResult,
} from "@shared/contract";

let settings: AppSettings;

/** Normalise a phone number to WhatsApp digits form (German local 0 → 49). */
function toWaNumber(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let d = raw.trim().replace(/[^\d+]/g, "");
  if (d.startsWith("+")) d = d.slice(1);
  else if (d.startsWith("00")) d = d.slice(2);
  else if (d.startsWith("0")) d = "49" + d.slice(1);
  d = d.replace(/\D/g, "");
  if (d.length < 8 || d.length > 15) return null;
  return d;
}

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

  ipcMain.handle(
    "pos:customersList",
    async (_e, opts: { q?: string; page?: number; pageSize?: number }) => {
      const qs = new URLSearchParams();
      if (opts.q) qs.set("q", opts.q);
      if (opts.page) qs.set("page", String(opts.page));
      if (opts.pageSize) qs.set("pageSize", String(opts.pageSize));
      const res = await session.authed<{
        customers: PosCustomer[];
        total: number;
        page: number;
        pageSize: number;
      }>(await baseUrl(), `/api/pos/customers/list?${qs.toString()}`);
      return res.ok
        ? { ok: true as const, ...res.data }
        : { ok: false as const, error: res.error, message: res.message, offline: res.offline };
    },
  );

  ipcMain.handle(
    "pos:createCustomer",
    async (_e, input: { firstName: string; lastName?: string; phone?: string; email?: string; birthDate?: string }) => {
      const res = await session.authed<{
        customer: PosCustomer;
        qr: { token: string; dataUrl: string };
        whatsapp?: string;
      }>(await baseUrl(), "/api/pos/customers", { method: "POST", body: input });
      return res.ok
        ? { ok: true as const, customer: res.data.customer, qr: res.data.qr, whatsapp: res.data.whatsapp }
        : { ok: false as const, error: res.error, message: res.message, offline: res.offline };
    },
  );

  ipcMain.handle(
    "pos:updateCustomer",
    async (
      _e,
      id: string,
      input: { firstName: string; lastName?: string; phone?: string; email?: string; birthDate?: string },
    ) => {
      const res = await session.authed<{ ok: boolean }>(
        await baseUrl(),
        `/api/pos/customers/${encodeURIComponent(id)}/update`,
        { method: "POST", body: input },
      );
      return res.ok
        ? { ok: true as const }
        : { ok: false as const, error: res.error, message: res.message, offline: res.offline };
    },
  );

  ipcMain.handle("pos:deleteCustomer", async (_e, id: string, password: string) => {
    const res = await session.authed<{ ok: boolean }>(
      await baseUrl(),
      `/api/pos/customers/${encodeURIComponent(id)}/delete`,
      { method: "POST", body: { password } },
    );
    return res.ok
      ? { ok: true as const }
      : { ok: false as const, error: res.error, message: res.message, offline: res.offline };
  });

  ipcMain.handle("pos:customerQr", async (_e, id: string) => {
    const res = await session.authed<{ token: string; dataUrl: string }>(
      await baseUrl(),
      `/api/pos/customers/${encodeURIComponent(id)}/qr`,
    );
    return res.ok
      ? { ok: true as const, qr: res.data }
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

  ipcMain.handle("pos:whatsappMessages", async (_e, limit?: number) => {
    const res = await session.authed<{ messages: unknown[] }>(
      await baseUrl(),
      `/api/pos/whatsapp/messages?limit=${limit ?? 50}`,
    );
    return res.ok
      ? { ok: true as const, messages: res.data.messages }
      : { ok: false as const, error: res.error, message: res.message, offline: res.offline };
  });

  ipcMain.handle(
    "pos:whatsappSend",
    async (_e, input: { to: string; message: string; customerId?: string }) => {
      const res = await session.authed<{ ok: boolean; messageId: string }>(
        await baseUrl(),
        "/api/pos/whatsapp/send",
        { method: "POST", body: input },
      );
      return res.ok
        ? { ok: true as const, messageId: res.data.messageId }
        : { ok: false as const, error: res.error, message: res.message, offline: res.offline };
    },
  );

  // Manual "send QR image over WhatsApp" — the desktop way to get the actual
  // IMAGE into the customer's chat without the Cloud API:
  //  1) copy the QR PNG to the system clipboard,
  //  2) open the WhatsApp Desktop app straight to the customer's chat (falling
  //     back to WhatsApp Web if the app isn't installed).
  // Staff then paste (Ctrl+V) the QR into the chat and press Send.
  ipcMain.handle(
    "pos:shareQrWhatsApp",
    async (_e, input: { dataUrl: string; phone: string | null; message: string }) => {
      try {
        const img = nativeImage.createFromDataURL(input.dataUrl);
        const copied = !img.isEmpty();
        if (copied) clipboard.writeImage(img);

        const num = toWaNumber(input.phone);
        let opened = false;
        if (num) {
          const text = encodeURIComponent(input.message);
          try {
            await shell.openExternal(`whatsapp://send?phone=${num}&text=${text}`);
            opened = true;
          } catch {
            // WhatsApp Desktop app not installed → open WhatsApp Web instead.
            await shell.openExternal(`https://wa.me/${num}?text=${text}`);
            opened = true;
          }
        }
        return { ok: true as const, copied, opened, invalidPhone: !num };
      } catch (e) {
        return { ok: false as const, error: e instanceof Error ? e.message : "share_failed" };
      }
    },
  );

  // Save the QR PNG to disk (a native save dialog) — the desktop "download".
  ipcMain.handle(
    "pos:saveQr",
    async (_e, input: { dataUrl: string; memberCode: string }) => {
      const win = getWindow();
      const { canceled, filePath } = await dialog.showSaveDialog(win ?? undefined!, {
        title: "Lưu mã QR",
        defaultPath: `qr-${input.memberCode}.png`,
        filters: [{ name: "PNG", extensions: ["png"] }],
      });
      if (canceled || !filePath) return { ok: false as const, canceled: true };
      try {
        const b64 = input.dataUrl.split(",")[1] ?? "";
        await writeFile(filePath, Buffer.from(b64, "base64"));
        return { ok: true as const, filePath };
      } catch (e) {
        return { ok: false as const, error: e instanceof Error ? e.message : "save_failed" };
      }
    },
  );

  ipcMain.handle("pos:rewards", async () => {
    const res = await session.authed<PosReward[]>(await baseUrl(), "/api/pos/rewards");
    return res.ok
      ? { ok: true as const, rewards: res.data }
      : { ok: false as const, error: res.error, message: res.message };
  });

  ipcMain.handle("pos:stats", async () => {
    const res = await session.authed<PosStats>(await baseUrl(), "/api/pos/stats");
    return res.ok
      ? { ok: true as const, stats: res.data }
      : { ok: false as const, error: res.error, message: res.message, offline: res.offline };
  });

  ipcMain.handle(
    "pos:transactionsList",
    async (_e, opts: { page?: number; pageSize?: number; customerId?: string }) => {
      const qs = new URLSearchParams();
      if (opts.page) qs.set("page", String(opts.page));
      if (opts.pageSize) qs.set("pageSize", String(opts.pageSize));
      if (opts.customerId) qs.set("customerId", opts.customerId);
      const res = await session.authed<{
        items: PosTransactionListItem[];
        total: number;
        page: number;
        pageSize: number;
      }>(await baseUrl(), `/api/pos/transactions/list?${qs.toString()}`);
      return res.ok
        ? { ok: true as const, ...res.data }
        : { ok: false as const, error: res.error, message: res.message, offline: res.offline };
    },
  );

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
