import { createStaticQrToken } from "@/lib/qr";
import { sendImageMessage, type WhatsAppCredentials } from "./client";

// Sends a new member their QR membership card over WhatsApp, right after signup.
// Uses the env WHATSAPP_ACCESS_TOKEN + Phone Number ID (single-business setup).
// Silent no-op when not configured; never throws — signup must never fail here.

function envCreds(): WhatsAppCredentials | null {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!accessToken) return null;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || "1230624066801987";
  return { accessToken, phoneNumberId, apiVersion: "v21.0" };
}

function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

export async function sendMemberCardWhatsApp(input: {
  businessId: string;
  customerId: string;
  memberCode: string;
  qrSecret: string;
  name: string;
  storeName: string;
  toPhone: string | null | undefined;
}): Promise<{ ok: boolean; skipped?: string; error?: string }> {
  try {
    if (!input.toPhone) return { ok: false, skipped: "no_phone" };
    const creds = envCreds();
    if (!creds) return { ok: false, skipped: "not_configured" };

    const token = createStaticQrToken({
      businessId: input.businessId,
      customerId: input.customerId,
      memberCode: input.memberCode,
      secret: input.qrSecret,
    });
    const imageUrl = `${appUrl()}/api/member/card?token=${encodeURIComponent(token)}`;
    const caption =
      `🎉 *${input.storeName}*\n` +
      `Chào ${input.name}! Đây là thẻ thành viên của bạn.\n` +
      `Mã thành viên: *${input.memberCode}*\n\n` +
      `Đưa mã QR này mỗi lần đến để tích điểm và nhận ưu đãi. Bạn có thể lưu lại ảnh này.`;

    const result = await sendImageMessage(creds, input.toPhone, imageUrl, caption);
    return result.ok ? { ok: true } : { ok: false, error: result.error };
  } catch (e) {
    console.error("[membership-card] send failed:", e instanceof Error ? e.message : e);
    return { ok: false, error: "exception" };
  }
}
