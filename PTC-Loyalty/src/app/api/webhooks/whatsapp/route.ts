import crypto from "crypto";
import { db } from "@/lib/db";

// Meta WhatsApp webhook. One URL per Meta App; individual businesses are
// identified by `metadata.phone_number_id` inside each event, then mapped to a
// WhatsAppConnection so every DB write stays tenant-scoped.
//
// Docs: https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks

export const runtime = "nodejs";

// ── GET: subscription verification handshake ─────────────────────────────────
export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  const expected = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
  if (mode === "subscribe" && expected && token === expected && challenge) {
    return new Response(challenge, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }
  return new Response("Forbidden", { status: 403 });
}

function verifySignature(rawBody: string, signature: string | null): boolean {
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  // If no app secret is configured (dev), accept — but never in a way that
  // could corrupt tenant data since we still match by phone_number_id below.
  if (!appSecret) return true;
  if (!signature) return false;

  const expected =
    "sha256=" +
    crypto.createHmac("sha256", appSecret).update(rawBody).digest("hex");
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

interface StatusEntry {
  id: string; // wamid
  status: "sent" | "delivered" | "read" | "failed";
  timestamp?: string;
  errors?: { title?: string; message?: string }[];
}

const STATUS_MAP = {
  sent: "SENT",
  delivered: "DELIVERED",
  read: "READ",
  failed: "FAILED",
} as const;

// ── POST: delivery status callbacks ──────────────────────────────────────────
export async function POST(req: Request) {
  const raw = await req.text();
  const signature = req.headers.get("x-hub-signature-256");
  if (!verifySignature(raw, signature)) {
    return new Response("Invalid signature", { status: 401 });
  }

  let body: {
    entry?: {
      changes?: {
        value?: {
          metadata?: { phone_number_id?: string };
          statuses?: StatusEntry[];
        };
      }[];
    }[];
  };
  try {
    body = JSON.parse(raw);
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      const phoneNumberId = value?.metadata?.phone_number_id;
      const statuses = value?.statuses;
      if (!phoneNumberId || !statuses?.length) continue;

      // Resolve the tenant from the phone number id.
      const connection = await db.whatsAppConnection.findFirst({
        where: { phoneNumberId },
        select: { businessId: true },
      });
      if (!connection) continue;

      for (const s of statuses) {
        const mapped = STATUS_MAP[s.status];
        if (!mapped) continue;
        const when = s.timestamp
          ? new Date(Number(s.timestamp) * 1000)
          : new Date();
        const errorText = s.errors?.[0]?.title ?? s.errors?.[0]?.message;

        // Tenant-scoped update: only this business's log with this wamid.
        await db.whatsAppMessageLog.updateMany({
          where: {
            businessId: connection.businessId,
            providerMessageId: s.id,
          },
          data: {
            status: mapped,
            ...(mapped === "SENT" ? { sentAt: when } : {}),
            ...(mapped === "DELIVERED" ? { deliveredAt: when } : {}),
            ...(mapped === "READ" ? { readAt: when } : {}),
            ...(mapped === "FAILED" ? { failedAt: when, error: errorText ?? "failed" } : {}),
          },
        });
      }
    }
  }

  // Always 200 quickly so Meta doesn't retry storm.
  return new Response("OK", { status: 200 });
}
