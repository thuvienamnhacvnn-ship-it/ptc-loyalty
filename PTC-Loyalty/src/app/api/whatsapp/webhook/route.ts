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
