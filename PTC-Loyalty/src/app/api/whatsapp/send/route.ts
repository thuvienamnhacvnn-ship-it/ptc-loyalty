// Simple test endpoint to send a WhatsApp text message via the Cloud API.
//   POST /api/whatsapp/send   body: { "to": "<phone>", "message": "<text>" }
//
// Uses the server-side WHATSAPP_ACCESS_TOKEN + Phone Number ID directly. This is
// a TEST helper — the production app sends per-tenant via encrypted tokens
// (see src/lib/whatsapp/service.ts). Reuses the shared client so there is one
// Graph API implementation.

import { NextRequest, NextResponse } from "next/server";
import { sendTextMessage } from "@/lib/whatsapp/client";

export const runtime = "nodejs";

// Phone Number ID from Meta → WhatsApp → API Setup. Configurable via env, with a
// fallback so this test route works out of the box.
const PHONE_NUMBER_ID =
  process.env.WHATSAPP_PHONE_NUMBER_ID || "1230624066801987";

export async function POST(req: NextRequest) {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!accessToken) {
    return NextResponse.json(
      { ok: false, error: "WHATSAPP_ACCESS_TOKEN chưa được cấu hình trên server." },
      { status: 500 },
    );
  }

  // Parse + validate body.
  let body: { to?: unknown; message?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: 'Body phải là JSON hợp lệ: { "to": "<số điện thoại>", "message": "<nội dung>" }',
      },
      { status: 400 },
    );
  }

  const to = typeof body.to === "string" ? body.to.trim() : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!to || !message) {
    return NextResponse.json(
      { ok: false, error: "Thiếu trường bắt buộc: 'to' (số điện thoại) và 'message' (nội dung)." },
      { status: 400 },
    );
  }

  // Send via the shared Graph API client (normalises the phone number to E.164
  // digits internally).
  const result = await sendTextMessage(
    { accessToken, phoneNumberId: PHONE_NUMBER_ID, apiVersion: "v21.0" },
    to,
    message,
  );

  if (result.ok) {
    console.log(`[whatsapp-send] ✅ sent to ${to} (wamid ${result.messageId})`);
    return NextResponse.json({ ok: true, to, messageId: result.messageId });
  }

  console.warn(`[whatsapp-send] ❌ failed to ${to}: ${result.error}`);
  // 502: the request was well-formed but the upstream WhatsApp API rejected it.
  return NextResponse.json(
    { ok: false, to, error: result.error, retriable: result.retriable },
    { status: 502 },
  );
}
