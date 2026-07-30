import crypto from "node:crypto";
import type { WhatsAppConnection } from "@prisma/client";
import { db } from "@/lib/db";
import { decryptSecret, encryptSecret, isEncryptionConfigured } from "@/lib/crypto";
import { defaultProviderId, getProvider } from "./providers";
import type {
  ConnectionState,
  WhatsappProvider,
  WhatsappSession,
} from "./providers/types";

/**
 * Per-tenant WhatsApp session lifecycle: "Kết nối WhatsApp" → login QR → paired.
 *
 * Each restaurant owns one provider-side session bound to ITS OWN WhatsApp
 * number. Nothing here knows which provider is in play — everything goes through
 * the WhatsappProvider interface.
 */

/** How long a login QR stays valid before we ask the provider for a fresh one. */
const QR_TTL_MS = 40_000;

/**
 * Base URL the PROVIDER uses to call us back. In the Docker deployment the
 * gateway sits on the internal network, so this is `http://app:3000` and the
 * webhook never leaves the host; it falls back to the public URL elsewhere.
 */
function webhookBaseUrl(): string {
  const base =
    process.env.WHATSAPP_WEBHOOK_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000";
  return base.replace(/\/$/, "");
}

/** Stable, provider-safe session name for a business. */
function instanceNameFor(businessId: string): string {
  return `ptc-${businessId}`.toLowerCase().replace(/[^a-z0-9-]/g, "");
}

/** Where the provider posts session + message events for this business. */
export function webhookUrlFor(businessId: string, secret: string): string {
  return `${webhookBaseUrl()}/api/whatsapp/webhook/${businessId}?secret=${encodeURIComponent(secret)}`;
}

function decryptToken(cipher: string | null): string | null {
  if (!cipher) return null;
  try {
    return decryptSecret(cipher);
  } catch {
    return null;
  }
}

function sessionOf(conn: WhatsAppConnection): WhatsappSession {
  return {
    businessId: conn.businessId,
    instanceId: conn.instanceId ?? instanceNameFor(conn.businessId),
    token: decryptToken(conn.instanceTokenCipher),
  };
}

/** Fetch the row, creating a DISCONNECTED one on first use. */
export async function getOrCreateConnection(businessId: string): Promise<WhatsAppConnection> {
  const existing = await db.whatsAppConnection.findUnique({ where: { businessId } });
  if (existing) return existing;
  return db.whatsAppConnection.create({
    data: {
      businessId,
      provider: defaultProviderId(),
      instanceId: instanceNameFor(businessId),
      webhookSecret: crypto.randomBytes(16).toString("hex"),
      status: "DISCONNECTED",
    },
  });
}

export function getConnection(businessId: string): Promise<WhatsAppConnection | null> {
  return db.whatsAppConnection.findUnique({ where: { businessId } });
}

/** Why a business cannot send right now. */
export type SessionBlocker = "not_connected" | "provider_not_configured";

export interface ResolvedSession {
  provider: WhatsappProvider;
  session: WhatsappSession;
  connection: WhatsAppConnection;
}

/**
 * The session to send with, or null when this business can't send. Every
 * outbound path funnels through here, so a disconnected tenant simply sends
 * nothing instead of falling back to somebody else's number.
 *
 * A CONNECTED row is NOT enough on its own: the deployment must actually have
 * the gateway configured. Rows upgraded from the old Meta integration carry a
 * stale CONNECTED status with no Web-MD session behind it, and without this
 * check they reach the provider and fail deep inside an HTTP call.
 */
export async function resolveSessionOrReason(
  businessId: string,
): Promise<{ ok: true; value: ResolvedSession } | { ok: false; reason: SessionBlocker }> {
  const conn = await getConnection(businessId);
  if (!conn || conn.status !== "CONNECTED" || !conn.instanceId) {
    return { ok: false, reason: "not_connected" };
  }
  const provider = getProvider(conn.provider);
  if (!provider.isConfigured()) {
    return { ok: false, reason: "provider_not_configured" };
  }
  return { ok: true, value: { provider, session: sessionOf(conn), connection: conn } };
}

export async function resolveSession(businessId: string): Promise<ResolvedSession | null> {
  const resolved = await resolveSessionOrReason(businessId);
  return resolved.ok ? resolved.value : null;
}

export interface ConnectionView {
  status: ConnectionState;
  providerId: string;
  providerLabel: string;
  /** Login QR to render while status is QR_PENDING. */
  qrDataUrl?: string;
  pairingCode?: string;
  phoneNumber?: string | null;
  profileName?: string | null;
  connectedAt?: Date | null;
  error?: string | null;
}

function viewOf(conn: WhatsAppConnection, extra?: Partial<ConnectionView>): ConnectionView {
  const provider = getProvider(conn.provider);
  return {
    status: conn.status as ConnectionState,
    providerId: provider.id,
    providerLabel: provider.label,
    qrDataUrl: conn.status === "QR_PENDING" ? conn.lastQr ?? undefined : undefined,
    phoneNumber: conn.displayPhoneNumber,
    profileName: conn.profileName,
    connectedAt: conn.connectedAt,
    error: conn.lastError,
    ...extra,
  };
}

/**
 * Start (or restart) pairing: asks the provider for a WhatsApp Web login QR that
 * the owner scans with their phone. Idempotent — calling it on a live session
 * just reports CONNECTED.
 */
export async function startConnection(businessId: string): Promise<ConnectionView> {
  let conn = await getOrCreateConnection(businessId);
  const provider = getProvider(conn.provider);

  if (!provider.isConfigured()) {
    conn = await db.whatsAppConnection.update({
      where: { businessId },
      data: { status: "ERROR", lastError: "provider_not_configured" },
    });
    return viewOf(conn);
  }

  const secret = conn.webhookSecret ?? crypto.randomBytes(16).toString("hex");
  const instanceId = conn.instanceId ?? instanceNameFor(businessId);
  const result = await provider.connect(
    { businessId, instanceId, token: decryptToken(conn.instanceTokenCipher) },
    { url: webhookUrlFor(businessId, secret) },
  );

  // Persist a freshly issued session token (encrypted) when we got one.
  const tokenCipher =
    result.token && isEncryptionConfigured()
      ? encryptSecret(result.token)
      : conn.instanceTokenCipher;

  const connected = result.state === "CONNECTED";
  conn = await db.whatsAppConnection.update({
    where: { businessId },
    data: {
      instanceId,
      webhookSecret: secret,
      instanceTokenCipher: tokenCipher,
      status: result.state,
      lastQr: result.qrDataUrl ?? null,
      lastQrAt: result.qrDataUrl ? new Date() : null,
      lastError: result.error ?? null,
      connectedAt: connected ? conn.connectedAt ?? new Date() : conn.connectedAt,
    },
  });

  // A session that came back already live still needs its number resolved.
  if (connected) return refreshConnection(businessId);
  return viewOf(conn, { pairingCode: result.pairingCode, qrDataUrl: result.qrDataUrl });
}

/**
 * Poll the provider for the live session state. The settings page calls this on
 * a timer while the QR is on screen; an expired QR is transparently replaced.
 */
export async function refreshConnection(businessId: string): Promise<ConnectionView> {
  const conn = await getConnection(businessId);
  if (!conn) {
    const provider = getProvider(null);
    return {
      status: "DISCONNECTED",
      providerId: provider.id,
      providerLabel: provider.label,
    };
  }

  const provider = getProvider(conn.provider);
  if (!provider.isConfigured()) {
    return viewOf(conn, { status: "ERROR", error: "provider_not_configured" });
  }

  const status = await provider.getStatus(sessionOf(conn));

  if (status.state === "CONNECTED") {
    const updated = await db.whatsAppConnection.update({
      where: { businessId },
      data: {
        status: "CONNECTED",
        displayPhoneNumber: status.phoneNumber ?? conn.displayPhoneNumber,
        profileName: status.profileName ?? conn.profileName,
        connectedAt: conn.connectedAt ?? new Date(),
        lastSeenAt: new Date(),
        lastQr: null,
        lastQrAt: null,
        lastError: null,
      },
    });
    return viewOf(updated);
  }

  // Still waiting for the scan: hand back the current QR, or fetch a fresh one
  // once the old one has expired.
  if (conn.status === "QR_PENDING") {
    const age = Date.now() - (conn.lastQrAt?.getTime() ?? 0);
    if (conn.lastQr && age < QR_TTL_MS) return viewOf(conn);
    return startConnection(businessId);
  }

  const updated = await db.whatsAppConnection.update({
    where: { businessId },
    data: {
      status: status.state,
      lastError: status.error ?? null,
      lastSeenAt: new Date(),
    },
  });
  return viewOf(updated);
}

/** Log the restaurant's number out and clear the stored session. */
export async function disconnectConnection(businessId: string): Promise<void> {
  const conn = await getConnection(businessId);
  if (!conn) return;

  const provider = getProvider(conn.provider);
  try {
    if (provider.isConfigured()) await provider.disconnect(sessionOf(conn));
  } catch (e) {
    console.error("[whatsapp] disconnect failed:", e instanceof Error ? e.message : e);
  }

  await db.whatsAppConnection.update({
    where: { businessId },
    data: {
      status: "DISCONNECTED",
      instanceTokenCipher: null,
      displayPhoneNumber: null,
      profileName: null,
      lastQr: null,
      lastQrAt: null,
      connectedAt: null,
      lastError: null,
    },
  });
}

/**
 * Apply a state change pushed by the provider's webhook (connection.update /
 * qrcode.updated), so the settings page flips to "connected" without polling.
 */
export async function applyProviderState(
  businessId: string,
  state: ConnectionState,
  extra: { phoneNumber?: string; profileName?: string; qrDataUrl?: string } = {},
): Promise<void> {
  const conn = await getConnection(businessId);
  if (!conn) return;

  if (state === "CONNECTED") {
    await db.whatsAppConnection.update({
      where: { businessId },
      data: {
        status: "CONNECTED",
        displayPhoneNumber: extra.phoneNumber ?? conn.displayPhoneNumber,
        profileName: extra.profileName ?? conn.profileName,
        connectedAt: conn.connectedAt ?? new Date(),
        lastSeenAt: new Date(),
        lastQr: null,
        lastQrAt: null,
        lastError: null,
      },
    });
    return;
  }

  await db.whatsAppConnection.update({
    where: { businessId },
    data: {
      status: extra.qrDataUrl ? "QR_PENDING" : state,
      ...(extra.qrDataUrl ? { lastQr: extra.qrDataUrl, lastQrAt: new Date() } : {}),
      lastSeenAt: new Date(),
    },
  });
}
