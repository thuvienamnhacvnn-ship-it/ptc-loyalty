import QRCode from "qrcode";
import { toWhatsAppNumber } from "@/lib/phone";
import type {
  ConnectResult,
  OutboundMedia,
  ProviderStatus,
  SendResult,
  WebhookTarget,
  WhatsappProvider,
  WhatsappSession,
} from "./types";

/**
 * Evolution API adapter — WhatsApp Web Multi-Device.
 *
 * Evolution is a self-hosted, open-source gateway that owns the long-lived
 * Baileys socket for each restaurant ("instance"). We never touch Meta: the
 * owner scans a normal WhatsApp Web login QR with their phone and every message
 * we send afterwards comes FROM that restaurant's own number.
 *
 * Config:
 *   EVOLUTION_API_URL      https://wa.example.com
 *   EVOLUTION_API_KEY      the gateway's global AUTHENTICATION_API_KEY
 *   EVOLUTION_API_VERSION  "v2" (default) | "v1" — request body shapes differ
 *
 * Docs: https://doc.evolution-api.com
 */

const HTTP_TIMEOUT_MS = 20_000;

function baseUrl(): string {
  return (process.env.EVOLUTION_API_URL ?? "").replace(/\/$/, "");
}

function globalKey(): string {
  return process.env.EVOLUTION_API_KEY ?? "";
}

function isV1(): boolean {
  return (process.env.EVOLUTION_API_VERSION ?? "v2").toLowerCase() === "v1";
}

/** Events we want pushed back to /api/whatsapp/webhook/[businessId]. */
const WEBHOOK_EVENTS = [
  "QRCODE_UPDATED",
  "CONNECTION_UPDATE",
  "MESSAGES_UPSERT",
  "MESSAGES_UPDATE",
  "SEND_MESSAGE",
];

type Json = Record<string, unknown>;

interface HttpResult {
  ok: boolean;
  status: number;
  body: Json;
  networkError?: string;
}

async function call(
  path: string,
  init: { method: "GET" | "POST" | "DELETE"; apiKey: string; body?: Json },
): Promise<HttpResult> {
  // Without a base URL this would build a relative path and fetch() would throw
  // "Failed to parse URL from /message/…". Fail with a readable reason instead.
  if (!baseUrl()) {
    return { ok: false, status: 0, body: {}, networkError: "evolution_not_configured" };
  }
  const url = `${baseUrl()}${path}`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: init.method,
      headers: {
        apikey: init.apiKey,
        ...(init.body ? { "Content-Type": "application/json" } : {}),
      },
      ...(init.body ? { body: JSON.stringify(init.body) } : {}),
      signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (err) {
    return {
      ok: false,
      status: 0,
      body: {},
      networkError: err instanceof Error ? err.message : "network_error",
    };
  }

  let body: Json = {};
  try {
    const parsed: unknown = await res.json();
    if (parsed && typeof parsed === "object") body = parsed as Json;
    else body = { data: parsed };
  } catch {
    /* empty / non-JSON body is fine */
  }
  return { ok: res.ok, status: res.status, body };
}

/** Pull a human-readable error out of an Evolution error envelope. */
function errorOf(r: HttpResult): string {
  if (r.networkError) return r.networkError;
  const b = r.body as { message?: unknown; error?: unknown; response?: unknown };
  const raw =
    (b.response as { message?: unknown } | undefined)?.message ?? b.message ?? b.error;
  if (Array.isArray(raw)) return raw.map(String).join("; ");
  if (typeof raw === "string") return raw;
  return `HTTP ${r.status}`;
}

/** 5xx / 429 / network problems are worth retrying; 4xx are our fault. */
function retriable(r: HttpResult): boolean {
  return !!r.networkError || r.status === 429 || r.status >= 500;
}

function sessionKey(session: WhatsappSession): string {
  return session.token || globalKey();
}

/** Evolution reports "open" | "connecting" | "close" | "refused". */
function mapState(raw: unknown): ProviderStatus["state"] {
  switch (String(raw ?? "").toLowerCase()) {
    case "open":
      return "CONNECTED";
    case "connecting":
      return "CONNECTING";
    case "close":
    case "closed":
      return "DISCONNECTED";
    default:
      return "DISCONNECTED";
  }
}

/** Turn whatever Evolution gave us into a renderable PNG data URL. */
async function toQrDataUrl(qr: unknown): Promise<string | undefined> {
  if (!qr || typeof qr !== "object") return undefined;
  const { base64, code } = qr as { base64?: unknown; code?: unknown };
  if (typeof base64 === "string" && base64.length > 0) {
    return base64.startsWith("data:") ? base64 : `data:image/png;base64,${base64}`;
  }
  // Some builds only return the raw pairing string — render it ourselves.
  if (typeof code === "string" && code.length > 0) {
    try {
      return await QRCode.toDataURL(code, { errorCorrectionLevel: "M", margin: 1, width: 320 });
    } catch {
      return undefined;
    }
  }
  return undefined;
}

/** The instance API key Evolution issues at creation (shape differs by version). */
function extractToken(body: Json): string | undefined {
  const hash = body.hash as unknown;
  if (typeof hash === "string" && hash) return hash;
  if (hash && typeof hash === "object") {
    const key = (hash as { apikey?: unknown }).apikey;
    if (typeof key === "string" && key) return key;
  }
  return undefined;
}

/** `4915212345678@s.whatsapp.net` → `4915212345678`. */
function jidToNumber(jid: unknown): string | undefined {
  if (typeof jid !== "string" || !jid) return undefined;
  const digits = jid.split("@")[0]?.split(":")[0]?.replace(/\D/g, "");
  return digits || undefined;
}

function webhookBody(webhook: WebhookTarget): Json {
  return isV1()
    ? {
        webhook: webhook.url,
        webhook_by_events: false,
        webhook_base64: false,
        events: WEBHOOK_EVENTS,
      }
    : {
        webhook: {
          enabled: true,
          url: webhook.url,
          byEvents: false,
          base64: false,
          events: WEBHOOK_EVENTS,
        },
      };
}

async function createInstance(
  session: WhatsappSession,
  webhook?: WebhookTarget,
): Promise<HttpResult> {
  return call("/instance/create", {
    method: "POST",
    apiKey: globalKey(),
    body: {
      instanceName: session.instanceId,
      qrcode: true,
      integration: "WHATSAPP-BAILEYS",
      ...(webhook ? webhookBody(webhook) : {}),
    },
  });
}

/** Look up the paired number + live state. Returns null when the instance is gone. */
async function fetchInstance(
  session: WhatsappSession,
): Promise<{ state: ProviderStatus["state"]; phoneNumber?: string; profileName?: string } | null> {
  const r = await call(
    `/instance/fetchInstances?instanceName=${encodeURIComponent(session.instanceId)}`,
    { method: "GET", apiKey: globalKey() },
  );
  if (!r.ok) return null;

  // v1 returns [{ instance: {...} }], v2 returns [{ ... }].
  const list = Array.isArray(r.body) ? (r.body as unknown[]) : ((r.body as { data?: unknown[] }).data ?? []);
  const first = list[0];
  if (!first || typeof first !== "object") return null;
  const row = ((first as { instance?: unknown }).instance ?? first) as Json;

  return {
    state: mapState(row.connectionStatus ?? row.state ?? row.status),
    phoneNumber: jidToNumber(row.ownerJid ?? row.owner),
    profileName: typeof row.profileName === "string" ? row.profileName : undefined,
  };
}

async function send(
  session: WhatsappSession,
  path: string,
  body: Json,
): Promise<SendResult> {
  const r = await call(path, { method: "POST", apiKey: sessionKey(session), body });
  if (!r.ok) return { ok: false, error: errorOf(r), retriable: retriable(r) };

  const key = (r.body as { key?: { id?: unknown } }).key;
  const id = typeof key?.id === "string" ? key.id : "";
  // Evolution answers 200/201 with the message key; a missing id still means
  // "accepted", so don't fail the send over it.
  return { ok: true, messageId: id };
}

/**
 * Shared preflight for the three send methods: the gateway must be configured
 * and the number must be usable. Returning a typed failure keeps every send
 * path honest instead of letting a half-built request reach fetch().
 */
function preflight(to: string): { ok: true; number: string } | { ok: false; result: SendResult } {
  if (!baseUrl() || !globalKey()) {
    return {
      ok: false,
      result: { ok: false, error: "provider_not_configured", retriable: false },
    };
  }
  const number = toWhatsAppNumber(to);
  if (!number) {
    return { ok: false, result: { ok: false, error: "invalid_phone", retriable: false } };
  }
  return { ok: true, number };
}

function mediaBody(
  to: string,
  media: OutboundMedia,
  mediatype: "image" | "document",
  caption?: string,
): Json {
  const common = {
    mediatype,
    mimetype: media.mimeType,
    media: media.base64,
    fileName: media.fileName,
    ...(caption ? { caption } : {}),
  };
  return isV1()
    ? { number: to, options: { delay: 0 }, mediaMessage: common }
    : { number: to, ...common };
}

export const evolutionProvider: WhatsappProvider = {
  id: "evolution",
  label: "Evolution API (WhatsApp Web Multi-Device)",

  isConfigured() {
    return !!baseUrl() && !!globalKey();
  },

  async connect(session, webhook): Promise<ConnectResult> {
    if (!this.isConfigured()) {
      return { state: "ERROR", error: "evolution_not_configured" };
    }

    // Already paired? Nothing to scan.
    const existing = await fetchInstance(session);
    if (existing?.state === "CONNECTED") return { state: "CONNECTED" };

    let token: string | undefined;
    if (!existing) {
      const created = await createInstance(session, webhook);
      // 403/409 = the instance already exists; fall through to /instance/connect.
      if (!created.ok && created.status !== 403 && created.status !== 409) {
        return { state: "ERROR", error: errorOf(created) };
      }
      if (created.ok) {
        token = extractToken(created.body);
        const qrDataUrl = await toQrDataUrl(created.body.qrcode);
        if (qrDataUrl) return { state: "QR_PENDING", qrDataUrl, token };
      }
    }

    const r = await call(`/instance/connect/${encodeURIComponent(session.instanceId)}`, {
      method: "GET",
      apiKey: token ?? sessionKey(session),
    });
    if (!r.ok) return { state: "ERROR", error: errorOf(r), token };

    // Either a fresh QR, or `{ instance: { state } }` when it reconnected on its own.
    const qrDataUrl = await toQrDataUrl(r.body.qrcode ?? r.body);
    if (qrDataUrl) {
      const pairing = (r.body as { pairingCode?: unknown }).pairingCode;
      return {
        state: "QR_PENDING",
        qrDataUrl,
        pairingCode: typeof pairing === "string" ? pairing : undefined,
        token,
      };
    }
    const inst = (r.body as { instance?: { state?: unknown } }).instance;
    return { state: mapState(inst?.state), token };
  },

  async disconnect(session) {
    // Log the phone out, then drop the instance so a later re-connect starts clean.
    await call(`/instance/logout/${encodeURIComponent(session.instanceId)}`, {
      method: "DELETE",
      apiKey: sessionKey(session),
    });
    await call(`/instance/delete/${encodeURIComponent(session.instanceId)}`, {
      method: "DELETE",
      apiKey: globalKey(),
    });
  },

  async getStatus(session): Promise<ProviderStatus> {
    if (!this.isConfigured()) return { state: "ERROR", error: "evolution_not_configured" };

    const r = await call(
      `/instance/connectionState/${encodeURIComponent(session.instanceId)}`,
      { method: "GET", apiKey: sessionKey(session) },
    );
    if (!r.ok) {
      // 404 simply means the instance no longer exists on the gateway.
      if (r.status === 404) return { state: "DISCONNECTED" };
      return { state: "ERROR", error: errorOf(r) };
    }
    const inst = (r.body as { instance?: { state?: unknown } }).instance;
    const state = mapState(inst?.state ?? (r.body as { state?: unknown }).state);

    // Enrich a live session with the restaurant's own number.
    if (state === "CONNECTED") {
      const details = await fetchInstance(session);
      return {
        state,
        phoneNumber: details?.phoneNumber,
        profileName: details?.profileName,
      };
    }
    return { state };
  },

  async sendText(session, to, text) {
    const pre = preflight(to);
    if (!pre.ok) return pre.result;
    const path = `/message/sendText/${encodeURIComponent(session.instanceId)}`;
    return send(
      session,
      path,
      isV1()
        ? { number: pre.number, options: { delay: 0 }, textMessage: { text } }
        : { number: pre.number, text },
    );
  },

  async sendImage(session, to, image, caption) {
    const pre = preflight(to);
    if (!pre.ok) return pre.result;
    const path = `/message/sendMedia/${encodeURIComponent(session.instanceId)}`;
    return send(session, path, mediaBody(pre.number, image, "image", caption));
  },

  async sendDocument(session, to, document, caption) {
    const pre = preflight(to);
    if (!pre.ok) return pre.result;
    const path = `/message/sendMedia/${encodeURIComponent(session.instanceId)}`;
    return send(session, path, mediaBody(pre.number, document, "document", caption));
  },
};
