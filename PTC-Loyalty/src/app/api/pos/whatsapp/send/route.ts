import crypto from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { requirePosContext, posError } from "@/lib/pos/context";
import { resolveSessionOrReason } from "@/lib/whatsapp/connection";
import { toWhatsAppNumber } from "@/lib/phone";
import { db } from "@/lib/db";

// POST /api/pos/whatsapp/send  — send a WhatsApp text from the desktop app.
//   Auth:  Bearer <POS access token>  (requirePosContext → tenant-scoped)
//   Body:  { to: string, message: string, customerId?: string }
//
// Sends from the caller's OWN paired WhatsApp number (see lib/whatsapp/connection).
// Every send is logged to WhatsAppMessageLog scoped to the caller's business.
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const auth = await requirePosContext(req);
  if (!auth.ok) {
    return NextResponse.json(posError(auth.error), { status: auth.status });
  }

  const attempt = await resolveSessionOrReason(auth.ctx.businessId);
  if (!attempt.ok) {
    return NextResponse.json(
      {
        error: attempt.reason,
        message:
          attempt.reason === "provider_not_configured"
            ? "Máy chủ chưa cấu hình WhatsApp gateway."
            : "Chưa kết nối WhatsApp. Vào Cài đặt → WhatsApp và quét mã QR đăng nhập.",
      },
      { status: 409 },
    );
  }
  const resolved = attempt.value;

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
  const phone = toWhatsAppNumber(to);
  if (!phone) {
    return NextResponse.json(
      { error: "bad_request", message: "Số điện thoại WhatsApp không hợp lệ." },
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

  const result = await resolved.provider.sendText(resolved.session, phone, message);

  // Persist to the tenant's message log (best-effort — never fail the send on a
  // logging error).
  try {
    await db.whatsAppMessageLog.create({
      data: {
        businessId: auth.ctx.businessId,
        customerId,
        kind: "MANUAL",
        direction: "OUTBOUND",
        status: result.ok ? "SENT" : "FAILED",
        toPhone: phone,
        language: resolved.connection.defaultLanguage,
        idempotencyKey: `pos-send:${crypto.randomUUID()}`,
        providerMessageId: result.ok ? result.messageId || null : null,
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
