// WhatsApp Cloud API webhook.
//   GET  → Meta subscription verification handshake (returns hub.challenge)
//   POST → incoming message / event notifications (logged, always 200 OK)
//
// URL:  https://ptc-loyalty.vercel.app/api/whatsapp/webhook
// Docs: https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks
//
// NOTE: this project also has a tenant-scoped delivery-status webhook at
// /api/webhooks/whatsapp. This endpoint is the simpler verify + message-log one.

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

// The token you enter in Meta → WhatsApp → Configuration → "Verify token".
// Configurable via env (recommended for prod); falls back to the agreed value
// so the endpoint works out of the box.
const VERIFY_TOKEN =
  process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || "ptc_loyalty_2026";

// ── GET: subscription verification handshake ─────────────────────────────────
// Meta calls this once when you save the webhook. If the token matches, we must
// echo back the raw `hub.challenge` value with HTTP 200.
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const mode = params.get("hub.mode");
  const token = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge");

  if (mode === "subscribe" && token === VERIFY_TOKEN && challenge) {
    console.log("[whatsapp-webhook] ✅ verification succeeded");
    return new NextResponse(challenge, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  console.warn("[whatsapp-webhook] ❌ verification failed", {
    mode,
    tokenMatches: token === VERIFY_TOKEN,
  });
  return new NextResponse("Forbidden", { status: 403 });
}

// Minimal shape of an inbound WhatsApp notification (only what we log).
type WhatsAppWebhookBody = {
  entry?: Array<{
    changes?: Array<{
      value?: {
        messages?: Array<{
          from?: string;
          type?: string;
          text?: { body?: string };
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

  // Best-effort per-message logging.
  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      for (const message of change.value?.messages ?? []) {
        console.log(
          `[whatsapp-webhook] message from ${message.from} (${message.type}): ${
            message.text?.body ?? "(non-text message)"
          }`,
        );
      }
    }
  }

  return new NextResponse("OK", { status: 200 });
}
