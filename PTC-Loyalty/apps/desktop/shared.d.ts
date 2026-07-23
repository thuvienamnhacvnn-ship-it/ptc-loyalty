// Global type for the preload bridge, shared by the Electron preload (which
// implements it) and the React renderer (which consumes it via window.pos).

import type {
  PosCustomer,
  PosCustomerDetail,
  PosEarnPreview,
  PosLoginResponse,
  PosReward,
  PosSessionInfo,
  PosTransactionResult,
  PosVoucherRedeemResult,
  PosWhatsAppMessage,
} from "@shared/contract";

export interface AppSettings {
  apiBaseUrl: string | null;
  cameraId: string | null;
  printerName: string | null;
  kioskMode: boolean;
  autoPrintReceipt: boolean;
}

export interface QueuedEarn {
  id: string;
  idempotencyKey: string;
  customerId: string;
  customerName: string;
  amount: number;
  receiptRef: string | null;
  branchId: string | null;
  createdAt: number;
  lastError?: string;
}

type Fail = { ok: false; error: string; message: string; offline?: boolean };

export interface PosBridge {
  status(): Promise<{ authenticated: boolean; baseUrl: string; online: boolean }>;
  ping(): Promise<boolean>;

  login(
    email: string,
    password: string,
    deviceLabel: string,
  ): Promise<{ ok: true; session: PosLoginResponse } | Fail>;
  logout(): Promise<{ ok: true }>;
  me(): Promise<{ ok: true; session: PosSessionInfo } | Fail>;

  search(q: string): Promise<{ ok: true; customer: PosCustomer } | Fail>;
  resolveQr(token: string): Promise<{ ok: true; customer: PosCustomer } | Fail>;
  customerDetail(id: string): Promise<{ ok: true; detail: PosCustomerDetail } | Fail>;
  createCustomer(input: {
    firstName: string;
    lastName?: string;
    phone?: string;
    email?: string;
    birthDate?: string;
  }): Promise<
    { ok: true; customer: PosCustomer; qr: { token: string; dataUrl: string } } | Fail
  >;
  updateCustomer(
    id: string,
    input: {
      firstName: string;
      lastName?: string;
      phone?: string;
      email?: string;
      birthDate?: string;
    },
  ): Promise<{ ok: true } | Fail>;
  deleteCustomer(id: string, password: string): Promise<{ ok: true } | Fail>;
  customerQr(
    id: string,
  ): Promise<{ ok: true; qr: { token: string; dataUrl: string } } | Fail>;

  whatsappMessages(
    limit?: number,
  ): Promise<{ ok: true; messages: PosWhatsAppMessage[] } | Fail>;
  whatsappSend(input: {
    to: string;
    message: string;
    customerId?: string;
  }): Promise<{ ok: true; messageId: string } | Fail>;
  preview(
    customerId: string,
    amount: number,
  ): Promise<{ ok: true; preview: PosEarnPreview } | Fail>;

  earn(input: {
    customerId: string;
    amount: number;
    receiptRef?: string;
    idempotencyKey: string;
    branchId?: string | null;
  }): Promise<{ ok: true; result: PosTransactionResult } | Fail>;
  redeem(input: {
    customerId: string;
    cost: number;
    rewardId?: string;
    note?: string;
    idempotencyKey: string;
    branchId?: string | null;
  }): Promise<{ ok: true; result: PosTransactionResult } | Fail>;
  voucherRedeem(
    code: string,
  ): Promise<{ ok: true; voucher: PosVoucherRedeemResult } | Fail>;
  rewards(): Promise<{ ok: true; rewards: PosReward[] } | Fail>;

  getSettings(): Promise<{
    settings: AppSettings;
    resolvedBaseUrl: string;
    defaultBaseUrl: string;
  }>;
  setSettings(
    patch: Partial<AppSettings>,
  ): Promise<{ ok: true; settings: AppSettings } | { ok: false; error: string }>;
  listPrinters(): Promise<
    { name: string; displayName: string; isDefault: boolean }[]
  >;

  queueList(): Promise<QueuedEarn[]>;
  queueCount(): Promise<number>;
  queueEnqueue(item: QueuedEarn): Promise<number>;
  queueSync(): Promise<{
    total: number;
    synced: number;
    failed: number;
    stillOffline: boolean;
  }>;

  printReceipt(data: unknown): Promise<{ ok: boolean; error?: string }>;

  toggleFullscreen(): Promise<boolean>;
  setKiosk(on: boolean): Promise<boolean>;

  installUpdate(): Promise<{ ok: true }>;
  onUpdate(cb: (channel: string, payload: unknown) => void): () => void;
}

declare global {
  interface Window {
    pos: PosBridge;
  }
}
