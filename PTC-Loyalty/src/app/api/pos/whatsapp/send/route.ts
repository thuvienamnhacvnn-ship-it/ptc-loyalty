import crypto from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { requirePosContext, posError } from "@/lib/pos/context";
import { sendTextMessage } from "@/lib/whatsapp/client";
import { db } from "@/lib/db";

// POST /api/pos/whatsapp/send  — send a WhatsApp text from the desktop app.
//   Auth:  Bearer <POS access token>  (requirePosContext → tenant-scoped)
//   Body:  { to: string, message: string, customerId?: string }
//
// Uses the env WHATSAPP_ACCESS_TOKEN + Phone Number ID (single-business setup).
// Every send is logged to WhatsAppMessageLog scoped to the caller's business.
export const dynamic = "force-dynamic";

const PHONE_NUMBER_ID =
  process.env.WHATSAPP_PHONE_NUMBER_ID || "1230624066801987";

export async function POST(req: NextRequest) {
  const auth = await requirePosContext(req);
  if (!auth.ok) {
    return NextResponse.json(posError(auth.error), { status: auth.status });
  }

  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!accessToken) {
    return NextResponse.json(
      { error: "not_configured", message: "WHATSAPP_ACCESS_TOKEN chưa cấu hình trên server." },
      { status: 500 },
    );
  }

  let body: { to?: unknown; message?: unknown; customerId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "bad_request", message: 'Body phải là JSON: { "to", "message" }' },
      { status: 400 },
    );
  }

  const to = typeof body.to === "string" ? body.to.trim() : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";
  const customerId = typeof body.customerId === "string" ? body.customerId : null;
  if (!to || !message) {
    return NextResponse.json(
      { error: "bad_request", message: "Thiếu 'to' (số điện thoại) hoặc 'message'." },
      { status: 400 },
    );
  }

  // If a customer is referenced, it MUST belong to the caller's business.
  if (customerId) {
    const owned = await db.customerProfile.findFirst({
      where: { id: customerId, businessId: auth.ctx.businessId },
      select: { id: true },
    });
    if (!owned) {
      return NextResponse.json(
        { error: "not_found", message: "Khách hàng không thuộc doanh nghiệp này." },
        { status: 404 },
      );
    }
  }

  const result = await sendTextMessage(
    { accessToken, phoneNumberId: PHONE_NUMBER_ID, apiVersion: "v21.0" },
    to,
    message,
  );

  // Persist to the tenant's message log (best-effort — never fail the send on a
  // logging error). kind=TEST is the closest existing enum value for an ad-hoc
  // manual message; a dedicated MANUAL kind can be added later.
  try {
    await db.whatsAppMessageLog.create({
      data: {
        businessId: auth.ctx.businessId,
        customerId,
        kind: "MANUAL",
        direction: "OUTBOUND",
        status: result.ok ? "SENT" : "FAILED",
        toPhone: to,
        language: "vi",
        idempotencyKey: `pos-send:${crypto.randomUUID()}`,
        providerMessageId: result.ok ? result.messageId : null,
        payloadSnapshot: { direction: "outbound", textBody: message, preview: message },
        sentAt: result.ok ? new Date() : null,
        failedAt: result.ok ? null : new Date(),
        error: result.ok ? null : result.error,
      },
    });
  } catch (e) {
    console.error("[pos/whatsapp/send] log failed:", e instanceof Error ? e.message : e);
  }

  if (result.ok) {
    return NextResponse.json({ ok: true, messageId: result.messageId });
  }
  return NextResponse.json(
    { error: "send_failed", message: result.error, retriable: result.retriable },
    { status: 502 },
  );
}
