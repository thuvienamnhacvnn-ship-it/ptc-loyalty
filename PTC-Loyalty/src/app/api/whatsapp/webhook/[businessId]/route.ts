import crypto from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { applyProviderState } from "@/lib/whatsapp/connection";
import { persistInboundMessage } from "@/lib/whatsapp/inbound";

/**
 * Provider callback, one URL per business:
 *   POST /api/whatsapp/webhook/<businessId>?secret=<webhookSecret>
 *
 * The tenant comes from the path (not from any payload field), and the secret is
 * compared in constant time, so one business can never write another's rows.
 *
 * Handles the WhatsApp Web Multi-Device session events Evolution API emits:
 *   qrcode.updated    → a fresh login QR to show in Settings
 *   connection.update → paired / dropped
 *   messages.upsert   → an inbound customer message
 *   messages.update   → delivery + read receipts
 * Other providers can post the same shapes or get their own adapter.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function secretMatches(provided: string | null, expected: string | null): boolean {
  if (!expected || !provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** "messages.upsert" | "MESSAGES_UPSERT" | "messages_upsert" → "messages.upsert" */
function normalizeEvent(raw: unknown): string {
  return String(raw ?? "").toLowerCase().replace(/_/g, ".");
}

function mapState(raw: unknown): "CONNECTED" | "CONNECTING" | "DISCONNECTED" {
  switch (String(raw ?? "").toLowerCase()) {
    case "open":
      return "CONNECTED";
    case "connecting":
      return "CONNECTING";
    default:
      return "DISCONNECTED";
  }
}

const RECEIPT_STATUS = {
  server_ack: "SENT",
  delivery_ack: "DELIVERED",
  read: "READ",
  played: "READ",
  error: "FAILED",
} as const;

function qrDataUrl(data: Record<string, unknown>): string | undefined {
  const qr = (data.qrcode ?? data) as { base64?: unknown };
  if (typeof qr.base64 === "string" && qr.base64) {
    return qr.base64.startsWith("data:") ? qr.base64 : `data:image/png;base64,${qr.base64}`;
  }
  return undefined;
}

/** `4915212345678@s.whatsapp.net` → `4915212345678` */
function jidToNumber(jid: unknown): string | undefined {
  if (typeof jid !== "string" || !jid) return undefined;
  const digits = jid.split("@")[0]?.split(":")[0]?.replace(/\D/g, "");
  return digits || undefined;
}

function textOf(message: unknown): string {
  if (!message || typeof message !== "object") return "";
  const m = message as {
    conversation?: unknown;
    extendedTextMessage?: { text?: unknown };
    imageMessage?: { caption?: unknown };
    videoMessage?: { caption?: unknown };
  };
  if (typeof m.conversation === "string") return m.conversation;
  if (typeof m.extendedTextMessage?.text === "string") return m.extendedTextMessage.text;
  if (typeof m.imageMessage?.caption === "string") return m.imageMessage.caption;
  if (typeof m.videoMessage?.caption === "string") return m.videoMessage.caption;
  return "";
}

async function handleReceipt(businessId: string, data: Record<string, unknown>) {
  const key = data.key as { id?: unknown } | undefined;
  const messageId =
    (typeof data.messageId === "string" && data.messageId) ||
    (typeof data.keyId === "string" && data.keyId) ||
    (typeof key?.id === "string" ? key.id : "");
  if (!messageId) return;

  const status =
    RECEIPT_STATUS[String(data.status ?? "").toLowerCase() as keyof typeof RECEIPT_STATUS];
  if (!status) return;

  const now = new Date();
  await db.whatsAppMessageLog.updateMany({
    where: { businessId, providerMessageId: messageId },
    data: {
      status,
      ...(status === "SENT" ? { sentAt: now } : {}),
      ...(status === "DELIVERED" ? { deliveredAt: now } : {}),
      ...(status === "READ" ? { readAt: now } : {}),
      ...(status === "FAILED" ? { failedAt: now } : {}),
    },
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ businessId: string }> },
) {
  const { businessId } = await params;

  const connection = await db.whatsAppConnection.findUnique({
    where: { businessId },
    select: { webhookSecret: true },
  });
  if (!connection) return NextResponse.json({ ok: true }); // unknown tenant — drop quietly
  if (!secretMatches(req.nextUrl.searchParams.get("secret"), connection.webhookSecret)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: true });
  }

  const event = normalizeEvent(payload.event);
  const data = (payload.data ?? {}) as Record<string, unknown>;

  try {
    switch (event) {
      case "qrcode.updated": {
        const qr = qrDataUrl(data);
        if (qr) await applyProviderState(businessId, "QR_PENDING", { qrDataUrl: qr });
        break;
      }

      case "connection.update": {
        const state = mapState(data.state ?? data.connection);
        await applyProviderState(businessId, state, {
          phoneNumber:
            jidToNumber(data.wuid ?? data.ownerJid ?? payload.sender) ?? undefined,
          profileName: typeof data.profileName === "string" ? data.profileName : undefined,
        });
        break;
      }

      case "messages.upsert": {
        const key = data.key as { id?: unknown; remoteJid?: unknown; fromMe?: unknown } | undefined;
        if (key?.fromMe) break; // our own echo
        const from = jidToNumber(key?.remoteJid);
        const id = typeof key?.id === "string" ? key.id : "";
        if (!from || !id) break;
        const ts = Number(data.messageTimestamp);
        await persistInboundMessage({
          businessId,
          fromPhone: from,
          text: textOf(data.message),
          messageId: id,
          timestamp: Number.isFinite(ts) ? ts : undefined,
        });
        break;
      }

      case "messages.update":
      case "send.message.update":
        await handleReceipt(businessId, data);
        break;

      default:
        break; // events we don't care about
    }
  } catch (e) {
    // Never make the provider retry-storm us over a bug on our side.
    console.error("[whatsapp-webhook] handler failed:", e instanceof Error ? e.message : e);
  }

  return NextResponse.json({ ok: true });
}
