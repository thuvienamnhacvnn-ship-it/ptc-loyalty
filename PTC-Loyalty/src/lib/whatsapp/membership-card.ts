import QRCode from "qrcode";
import { db } from "@/lib/db";
import { createStaticQrToken } from "@/lib/qr";
import {
  getTemplateStatus,
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
}): Promise<{
  ok: boolean;
  skipped?: string;
  error?: string;
  /** How the card was actually sent — callers surface an honest status:
   *  "template" delivers to ANY customer; "freeform"/"link" only reach a
   *  customer who messaged us within the last 24h (or an allow-listed test #). */
  method?: "template" | "freeform" | "link";
}> {
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

    // Delivery strategy (best → fallback), never throwing:
    //  1) If an image-header template is configured AND currently APPROVED on Meta
    //     → send the TEMPLATE (business-initiated, works for ANY new customer,
    //     outside the 24h window). We check status FIRST so an in-review/rejected
    //     template never triggers a #132001 send error in production.
    //  2) Else send the image by media id (free-form; needs the 24h window /
    //     allow-listed test number).
    //  3) If the upload failed, fall back to the public image link.
    const templateName = process.env.WHATSAPP_MEMBER_TEMPLATE;
    const templateLang = process.env.WHATSAPP_MEMBER_TEMPLATE_LANG || "vi";
    const wabaId = process.env.WHATSAPP_WABA_ID || "1014775701528488";

    const freeFormImage = () =>
      sendImageMessageByMediaId(creds, input.toPhone!, uploaded.ok ? uploaded.mediaId : "", caption);

    let result;
    // Track HOW it was actually sent, so callers can show an honest status.
    let method: "template" | "freeform" | "link" = "freeform";
    if (uploaded.ok && templateName) {
      const status = await getTemplateStatus(
        creds.accessToken,
        wabaId,
        templateName,
        templateLang,
        creds.apiVersion,
      );
      // Only SKIP the template when we positively know it is not usable. A null
      // status means we couldn't read it (e.g. the token lacks the management
      // permission) — in that case we still attempt the template so an approved
      // one keeps working, and rely on the send-failure fallback below.
      const knownNotApproved = status !== null && status !== "APPROVED";
      if (knownNotApproved) {
        // Do NOT call the template send API for an in-review/rejected template
        // (this is what produced #132001). Use the free-form image instead.
        console.warn(
          `[membership-card] template "${templateName}" is not APPROVED (status=${status}); skipping template, using free-form image`,
        );
        result = await freeFormImage();
        method = "freeform";
      } else {
        // NAMED variables matching the approved `ptc_welcome` template on Meta:
        // header = QR image, body has {{customer_name}} + {{member_code}}. (An
        // APPROVED template delivers to ANY customer immediately, with no 24h
        // window.) The template author decides the variables; ours has both, so
        // we always pass both. If you point WHATSAPP_MEMBER_TEMPLATE at a template
        // with a different variable set, update this list to match it exactly.
        result = await sendImageTemplate(
          creds,
          input.toPhone,
          templateName,
          templateLang,
          uploaded.mediaId,
          [
            { name: "customer_name", text: input.name },
            { name: "member_code", text: input.memberCode },
          ],
        );
        if (result.ok) {
          method = "template";
        } else {
          // Even an APPROVED (or status-unknown) template can fail → degrade to free-form.
          console.warn(
            `[membership-card] template "${templateName}" send failed (${result.error}); falling back to free-form image`,
          );
          result = await freeFormImage();
          method = "freeform";
        }
      }
    } else if (uploaded.ok) {
      result = await freeFormImage();
      method = "freeform";
    } else {
      result = await sendImageMessage(
        creds,
        input.toPhone,
        `${appUrl()}/api/member/card?token=${encodeURIComponent(token)}`,
        caption,
      );
      method = "link";
    }

    // Persist an outbound log so its delivery status (updated by the webhook,
    // matched on the wamid) is visible in Settings → WhatsApp. Never let a
    // logging failure affect the send result / signup.
    try {
      await db.whatsAppMessageLog.create({
        data: {
          businessId: input.businessId,
          customerId: input.customerId,
          kind: "MANUAL",
          status: result.ok ? "SENT" : "FAILED",
          direction: "OUTBOUND",
          toPhone: input.toPhone,
          language: templateLang,
          templateKey: method === "template" ? templateName : null,
          idempotencyKey: `member-card:${input.customerId}:${Date.now()}`,
          providerMessageId: result.ok ? result.messageId : null,
          error: result.ok ? null : result.error,
          sentAt: result.ok ? new Date() : null,
          failedAt: result.ok ? null : new Date(),
        },
      });
    } catch (logErr) {
      console.error(
        "[membership-card] log write failed:",
        logErr instanceof Error ? logErr.message : logErr,
      );
    }

    return result.ok ? { ok: true, method } : { ok: false, error: result.error, method };
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
