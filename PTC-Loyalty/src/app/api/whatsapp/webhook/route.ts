// WhatsApp Cloud API webhook.
//   GET  → Meta subscription verification handshake (returns hub.challenge)
//   POST → incoming message / event notifications (logged, always 200 OK)
//
// URL:  https://ptc-bonus.com/api/whatsapp/webhook
// Docs: https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks
//
// NOTE: this project also has a tenant-scoped delivery-status webhook at
// /api/webhooks/whatsapp. This endpoint is the simpler verify + message-log one.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { persistInboundMessage } from "@/lib/whatsapp/inbound";

export const runtime = "nodejs";

// Meta delivery-status → our WhatsAppMessageLog.status enum.
const STATUS_MAP = {
  sent: "SENT",
  delivered: "DELIVERED",
  read: "READ",
  failed: "FAILED",
} as const;

// The token you enter in Meta → WhatsApp → Configuration → "Verify token".
// Configurable via env (recommended for prod); falls back to the agreed value
// so the endpoint works out of the box.
const VERIFY_TOKEN =
  process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || "ptc_loyalty_2026";

// ── GET: subscription verification handshake ─────────────────────────────────
// Meta calls this once when you save the webhook, with:
//   ?hub.mode=subscribe&hub.verify_token=<token>&hub.challenge=<challenge>
// If the token matches we MUST echo back the raw `hub.challenge` with HTTP 200.
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const mode = params.get("hub.mode");
  const token = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge");

  // .trim() guards against an accidental trailing space in the Meta token field.
  const tokenMatches = (token ?? "").trim() === VERIFY_TOKEN.trim();

  // 1) Meta verification handshake — echo the challenge back verbatim.
  if (mode === "subscribe" && tokenMatches && challenge) {
    console.log("[whatsapp-webhook] ✅ verification succeeded");
    return new NextResponse(challenge, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  // 2) A real verification attempt but with a WRONG token — reject (security).
  //    A correctly-configured Meta webhook never reaches this branch.
  if (mode === "subscribe") {
    console.warn("[whatsapp-webhook] ❌ verify_token mismatch");
    return new NextResponse("Verification failed: invalid verify_token", {
      status: 403,
    });
  }

  // 3) Any other GET (e.g. opening the URL in a browser) — friendly 200 so the
  //    endpoint doesn't look broken. This is NOT the path Meta uses.
  return new NextResponse(
    "WhatsApp webhook is active. Verification is handled via hub.* query params.",
    { status: 200, headers: { "Content-Type": "text/plain" } },
  );
}

// Minimal shape of an inbound WhatsApp notification (only what we use).
type WhatsAppWebhookBody = {
  entry?: Array<{
    changes?: Array<{
      value?: {
        metadata?: { phone_number_id?: string };
        messages?: Array<{
          id?: string;
          from?: string;
          type?: string;
          timestamp?: string;
          text?: { body?: string };
        }>;
        statuses?: Array<{
          id?: string; // wamid of a message WE sent
          status?: "sent" | "delivered" | "read" | "failed";
          timestamp?: string;
          errors?: Array<{ title?: string; message?: string }>;
        }>;
      };
    }>;
  }>;
};

// ── POST: incoming messages / events ─────────────────────────────────────────
// Always acknowledge quickly with 200 so Meta does not retry-storm.
export async function POST(req: NextRequest) {
  let body: WhatsAppWebhookBody;
  try {
    body = (await req.json()) as WhatsAppWebhookBody;
  } catch {
    return new NextResponse("Bad Request", { status: 400 });
  }

  console.log(
    "[whatsapp-webhook] 📩 incoming payload:",
    JSON.stringify(body, null, 2),
  );

  // Persist each inbound message to the DB (tenant-scoped, deduped by wamid).
  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const phoneNumberId = change.value?.metadata?.phone_number_id;
      for (const message of change.value?.messages ?? []) {
        const text = message.text?.body ?? "";
        console.log(
          `[whatsapp-webhook] message from ${message.from} (${message.type}): ${
            text || "(non-text message)"
          }`,
        );
        if (message.id && message.from) {
          await persistInboundMessage({
            phoneNumberId,
            fromPhone: message.from,
            text,
            wamid: message.id,
            timestamp: message.timestamp ? Number(message.timestamp) : undefined,
          });
        }
      }

      // Delivery-status callbacks for messages WE sent. Update the matching
      // outbound log by wamid (globally unique → safe to match without a tenant
      // filter), so the real "Đã giao / Thất bại" status shows in the UI.
      for (const s of change.value?.statuses ?? []) {
        const mapped = s.status ? STATUS_MAP[s.status] : undefined;
        if (!s.id || !mapped) continue;
        const when = s.timestamp ? new Date(Number(s.timestamp) * 1000) : new Date();
        const errorText = s.errors?.[0]?.title ?? s.errors?.[0]?.message;
        try {
          await db.whatsAppMessageLog.updateMany({
            where: { providerMessageId: s.id },
            data: {
              status: mapped,
              ...(mapped === "SENT" ? { sentAt: when } : {}),
              ...(mapped === "DELIVERED" ? { deliveredAt: when } : {}),
              ...(mapped === "READ" ? { readAt: when } : {}),
              ...(mapped === "FAILED" ? { failedAt: when, error: errorText ?? "failed" } : {}),
            },
          });
        } catch (e) {
          console.error(
            "[whatsapp-webhook] status update failed:",
            e instanceof Error ? e.message : e,
          );
        }
      }
    }
  }

  return new NextResponse("OK", { status: 200 });
}
