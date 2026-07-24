import QRCode from "qrcode";
import { db } from "@/lib/db";
import { createStaticQrToken } from "@/lib/qr";
import {
  sendImageMessage,
  sendImageMessageByMediaId,
  sendImageTemplate,
  sendTextMessage,
  uploadImageMedia,
  type WhatsAppCredentials,
} from "./client";

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
    const caption =
      `🎉 *${input.storeName}*\n` +
      `Chào ${input.name}! Đây là thẻ thành viên của bạn.\n` +
      `Mã thành viên: *${input.memberCode}*\n\n` +
      `Đưa mã QR này mỗi lần đến để tích điểm và nhận ưu đãi. Bạn có thể lưu lại ảnh này.`;

    // Upload the QR PNG as media (Meta doesn't have to fetch our URL).
    const png = await QRCode.toBuffer(token, { errorCorrectionLevel: "M", margin: 2, width: 512 });
    const uploaded = await uploadImageMedia(creds, new Uint8Array(png));

    // Delivery strategy:
    //  1) If an approved image-header template is configured → send the TEMPLATE
    //     (business-initiated, works for ANY new customer, no 24h window).
    //  2) Else send the image by media id (free-form; needs 24h window / test #).
    //  3) If the upload failed, fall back to the public image link.
    const templateName = process.env.WHATSAPP_MEMBER_TEMPLATE;
    const templateLang = process.env.WHATSAPP_MEMBER_TEMPLATE_LANG || "vi";

    let result;
    if (uploaded.ok && templateName) {
      // NAMED variable matching the approved `ptc_member_card` (Utility) template
      // on Meta: header = QR image, body has a single {{customer_name}} variable.
      // The member code is intentionally NOT a template variable — Meta's classifier
      // treats a "code = value" body as an Authentication template and rejects it,
      // so the code lives only in the free-form caption path below. The QR image in
      // the header already carries the member's identity.
      result = await sendImageTemplate(
        creds,
        input.toPhone,
        templateName,
        templateLang,
        uploaded.mediaId,
        [{ name: "customer_name", text: input.name }],
      );
    } else if (uploaded.ok) {
      result = await sendImageMessageByMediaId(creds, input.toPhone, uploaded.mediaId, caption);
    } else {
      result = await sendImageMessage(
        creds,
        input.toPhone,
        `${appUrl()}/api/member/card?token=${encodeURIComponent(token)}`,
        caption,
      );
    }
    return result.ok ? { ok: true } : { ok: false, error: result.error };
  } catch (e) {
    console.error("[membership-card] send failed:", e instanceof Error ? e.message : e);
    return { ok: false, error: "exception" };
  }
}

/**
 * Env-token fallback for the "+X điểm" WhatsApp notice after earning points.
 * Skips silently when a per-tenant WhatsAppConnection is CONNECTED (the service
 * already sent it) or when creds/phone are missing. Never throws.
 */
export async function sendPointsEarnedWhatsApp(input: {
  businessId: string;
  customerId: string;
  points: number;
  balanceAfter: number;
  storeName: string;
}): Promise<void> {
  try {
    const creds = envCreds();
    if (!creds) return;
    // Avoid double-send: the per-tenant service handles CONNECTED businesses.
    const conn = await db.whatsAppConnection.findUnique({
      where: { businessId: input.businessId },
      select: { status: true },
    });
    if (conn?.status === "CONNECTED") return;

    const customer = await db.customerProfile.findFirst({
      where: { id: input.customerId, businessId: input.businessId },
      select: { phone: true },
    });
    if (!customer?.phone) return;

    const text =
      `✅ ${input.storeName}: Bạn vừa được cộng *+${input.points} điểm*.\n` +
      `Số dư hiện tại: *${input.balanceAfter} điểm*. Cảm ơn bạn! ❤️`;
    await sendTextMessage(creds, customer.phone, text);
  } catch (e) {
    console.error("[points-earned-wa] failed:", e instanceof Error ? e.message : e);
  }
}
