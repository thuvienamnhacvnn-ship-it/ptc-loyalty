import QRCode from "qrcode";
import { db } from "@/lib/db";
import { createStaticQrToken } from "@/lib/qr";
import { toWhatsAppNumber } from "@/lib/phone";
import { resolveSessionOrReason } from "./connection";
import { resolveBody } from "./service";
import { normalizeLanguage } from "./templates";
import type { SendResult, WhatsappProvider, WhatsappSession } from "./providers/types";

/**
 * Step 4 of the signup flow: right after a member is saved, the restaurant's OWN
 * WhatsApp number greets the customer with
 *   1) a welcome message (name + member code),
 *   2) the membership QR image already produced by src/lib/qr.ts,
 *   3) short usage instructions (the image caption).
 *
 * Silent no-op when the business hasn't paired its number — signup must never
 * fail because of messaging.
 */

export interface MemberCardResult {
  ok: boolean;
  /**
   * Why nothing was sent — a state, not a crash:
   * no_phone | not_connected | provider_not_configured | toggle_off.
   */
  skipped?: string;
  error?: string;
}

/** Persist an outbound message so it shows up in Settings → WhatsApp. */
async function logSend(input: {
  businessId: string;
  customerId: string;
  toPhone: string;
  language: string;
  templateKey: string;
  text: string;
  result: SendResult;
}): Promise<void> {
  try {
    await db.whatsAppMessageLog.create({
      data: {
        businessId: input.businessId,
        customerId: input.customerId,
        kind: "WELCOME",
        direction: "OUTBOUND",
        status: input.result.ok ? "SENT" : "FAILED",
        toPhone: input.toPhone,
        language: input.language,
        templateKey: input.templateKey,
        idempotencyKey: `${input.templateKey}:${input.customerId}:${Date.now()}`,
        providerMessageId: input.result.ok ? input.result.messageId || null : null,
        payloadSnapshot: { direction: "outbound", textBody: input.text, preview: input.text },
        error: input.result.ok ? null : input.result.error,
        sentAt: input.result.ok ? new Date() : null,
        failedAt: input.result.ok ? null : new Date(),
      },
    });
  } catch (e) {
    console.error("[member-card] log write failed:", e instanceof Error ? e.message : e);
  }
}

export async function sendMemberCardWhatsApp(input: {
  businessId: string;
  customerId: string;
  memberCode: string;
  qrSecret: string;
  name: string;
  storeName: string;
  toPhone: string | null | undefined;
}): Promise<MemberCardResult> {
  try {
    const phone = toWhatsAppNumber(input.toPhone);
    if (!phone) return { ok: false, skipped: "no_phone" };

    // The business must have paired ITS OWN number first.
    const attempt = await resolveSessionOrReason(input.businessId);
    if (!attempt.ok) return { ok: false, skipped: attempt.reason };
    const resolved = attempt.value;
    if (!resolved.connection.notifyOnSignup) return { ok: false, skipped: "toggle_off" };

    const provider: WhatsappProvider = resolved.provider;
    const session: WhatsappSession = resolved.session;
    const language = normalizeLanguage(resolved.connection.defaultLanguage);

    // Reuse the identity QR the platform already generates — nothing new here.
    const token = createStaticQrToken({
      businessId: input.businessId,
      customerId: input.customerId,
      memberCode: input.memberCode,
      secret: input.qrSecret,
    });
    const png = await QRCode.toBuffer(token, {
      errorCorrectionLevel: "M",
      margin: 2,
      width: 512,
    });

    const memberUrl = `${(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "")}/member`;
    const welcome = await resolveBody(input.businessId, "welcome", language, [
      input.storeName,
      input.name,
      input.memberCode,
      memberUrl,
    ]);
    const caption = await resolveBody(input.businessId, "member_card", language, [
      input.storeName,
      input.memberCode,
    ]);

    // 1) Welcome text.
    const textResult = await provider.sendText(session, phone, welcome);
    await logSend({
      businessId: input.businessId,
      customerId: input.customerId,
      toPhone: phone,
      language,
      templateKey: "welcome",
      text: welcome,
      result: textResult,
    });

    // 2) QR image + usage instructions.
    const imageResult = await provider.sendImage(
      session,
      phone,
      {
        base64: Buffer.from(png).toString("base64"),
        mimeType: "image/png",
        fileName: `member-${input.memberCode}.png`,
      },
      caption,
    );
    await logSend({
      businessId: input.businessId,
      customerId: input.customerId,
      toPhone: phone,
      language,
      templateKey: "member_card",
      text: caption,
      result: imageResult,
    });

    // The QR is the point of the flow — report failure if the image didn't go out.
    if (!imageResult.ok) return { ok: false, error: imageResult.error };
    return { ok: true };
  } catch (e) {
    console.error("[member-card] send failed:", e instanceof Error ? e.message : e);
    return { ok: false, error: "exception" };
  }
}
