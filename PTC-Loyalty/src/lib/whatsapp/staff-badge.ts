import QRCode from "qrcode";
import { db } from "@/lib/db";
import { createStaffQrToken } from "@/lib/staff-qr";
import { toWhatsAppNumber } from "@/lib/phone";
import { resolveSessionOrReason } from "./connection";
import type { SendResult, WhatsappProvider, WhatsappSession } from "./providers/types";
import { staffDisplayName, staffNameSelect } from "@/lib/staff-name";

/**
 * Gửi thẻ chấm công về WhatsApp của nhân viên ngay lúc nhận việc.
 *
 * Đây là bước cuối của luồng thêm nhân viên: quán nhập tên và số điện thoại,
 * hệ thống sinh thẻ rồi bắn thẳng vào máy người đó. Nhân viên không cần chờ
 * quản lý in giấy, và hôm sau đi làm là quét được ngay bằng ảnh trong máy.
 *
 * KHÔNG bao giờ làm hỏng việc tạo nhân viên: quán chưa ghép số WhatsApp, hay
 * nhân viên nhập sai số, thì hàm này trả về lý do bỏ qua chứ không ném lỗi.
 * Thẻ vẫn tồn tại và vẫn in được từ màn hình Nhân viên.
 */

export interface StaffBadgeResult {
  ok: boolean;
  /** Lý do không gửi — một trạng thái, không phải lỗi hệ thống. */
  skipped?: "no_phone" | "not_connected" | "provider_not_configured" | "no_staff";
  error?: string;
}

/** Câu chữ tiếng Việt cho tin nhắn — nhân viên quán Việt ở Đức đọc tiếng Việt. */
function badgeText(storeName: string, name: string): string {
  return (
    `Chào ${name}, bạn đã được thêm vào đội ngũ của ${storeName}.\n\n` +
    `Đây là THẺ CHẤM CÔNG của riêng bạn. Khi tới quán, đưa mã này vào máy chấm công ` +
    `để ghi giờ vào ca, và quét lại lần nữa khi tan ca.\n\n` +
    `Giữ ảnh này trong máy, hoặc in ra mang theo. Không đưa cho người khác quét hộ. ` +
    `Nếu mất máy, báo quản lý cấp thẻ mới ngay.`
  );
}

function captionText(name: string, employeeNo: string | null): string {
  return employeeNo
    ? `Thẻ chấm công — ${name} (${employeeNo})`
    : `Thẻ chấm công — ${name}`;
}

/** Ghi lại tin đã gửi để nó hiện trong Cài đặt → WhatsApp. */
async function logSend(input: {
  businessId: string;
  staffProfileId: string;
  toPhone: string;
  templateKey: string;
  text: string;
  result: SendResult;
}): Promise<void> {
  try {
    await db.whatsAppMessageLog.create({
      data: {
        businessId: input.businessId,
        // Tin này gửi cho NHÂN VIÊN chứ không phải khách, nên không có customerId.
        customerId: null,
        kind: "STAFF_BADGE",
        direction: "OUTBOUND",
        status: input.result.ok ? "SENT" : "FAILED",
        toPhone: input.toPhone,
        language: "vi",
        templateKey: input.templateKey,
        idempotencyKey: `${input.templateKey}:${input.staffProfileId}:${Date.now()}`,
        providerMessageId: input.result.ok ? input.result.messageId || null : null,
        payloadSnapshot: { direction: "outbound", textBody: input.text, preview: input.text },
        error: input.result.ok ? null : input.result.error,
        sentAt: input.result.ok ? new Date() : null,
        failedAt: input.result.ok ? null : new Date(),
      },
    });
  } catch (e) {
    console.error("[staff-badge] log write failed:", e instanceof Error ? e.message : e);
  }
}

/**
 * Gửi (hoặc gửi lại) thẻ chấm công cho một nhân viên.
 * Đọc `qrSecret` tại thời điểm gửi, nên sau khi thu hồi thẻ thì gọi lại hàm này
 * là nhân viên nhận đúng thẻ mới.
 */
export async function sendStaffBadgeWhatsApp(input: {
  businessId: string;
  staffProfileId: string;
}): Promise<StaffBadgeResult> {
  try {
    const staff = await db.staffProfile.findFirst({
      where: { id: input.staffProfileId, businessId: input.businessId },
      select: {
        id: true,
        qrSecret: true,
        phone: true,
        employeeNo: true,
        ...staffNameSelect,
        business: { select: { name: true } },
      },
    });
    if (!staff) return { ok: false, skipped: "no_staff" };

    const phone = toWhatsAppNumber(staff.phone);
    if (!phone) return { ok: false, skipped: "no_phone" };

    // Quán phải ghép số WhatsApp của chính mình trước.
    const attempt = await resolveSessionOrReason(input.businessId);
    if (!attempt.ok) return { ok: false, skipped: attempt.reason };
    const resolved = attempt.value;

    const provider: WhatsappProvider = resolved.provider;
    const session: WhatsappSession = resolved.session;
    const name = staffDisplayName(staff);

    const token = createStaffQrToken({
      businessId: input.businessId,
      staffProfileId: staff.id,
      secret: staff.qrSecret,
    });
    const png = await QRCode.toBuffer(token, {
      // Mức sửa lỗi cao vì ảnh này sẽ bị chụp lại màn hình, in ra, gấp trong túi.
      errorCorrectionLevel: "H",
      margin: 2,
      width: 512,
    });

    // 1) Lời nhắn kèm hướng dẫn.
    const text = badgeText(staff.business.name, name);
    const textResult = await provider.sendText(session, phone, text);
    await logSend({
      businessId: input.businessId,
      staffProfileId: staff.id,
      toPhone: phone,
      templateKey: "staff_badge_intro",
      text,
      result: textResult,
    });

    // 2) Ảnh thẻ.
    const caption = captionText(name, staff.employeeNo);
    const imageResult = await provider.sendImage(
      session,
      phone,
      {
        base64: Buffer.from(png).toString("base64"),
        mimeType: "image/png",
        fileName: `the-cham-cong-${staff.employeeNo ?? staff.id}.png`,
      },
      caption,
    );
    await logSend({
      businessId: input.businessId,
      staffProfileId: staff.id,
      toPhone: phone,
      templateKey: "staff_badge",
      text: caption,
      result: imageResult,
    });

    // Ảnh thẻ mới là mục đích của cả luồng — chữ đi được mà ảnh hỏng vẫn là hỏng.
    if (!imageResult.ok) return { ok: false, error: imageResult.error };
    return { ok: true };
  } catch (e) {
    console.error("[staff-badge] send failed:", e instanceof Error ? e.message : e);
    return { ok: false, error: "exception" };
  }
}

/** Câu giải thích cho người dùng, từ mã lý do bỏ qua. */
export function badgeSkipReason(skipped: StaffBadgeResult["skipped"]): string {
  switch (skipped) {
    case "no_phone":
      return "Số điện thoại không hợp lệ nên chưa gửi được thẻ qua WhatsApp.";
    case "not_connected":
      return "Quán chưa ghép số WhatsApp (Cài đặt → WhatsApp) nên chưa gửi được thẻ.";
    case "provider_not_configured":
      return "Máy chủ chưa cấu hình WhatsApp nên chưa gửi được thẻ.";
    case "no_staff":
      return "Không tìm thấy nhân viên.";
    default:
      return "Chưa gửi được thẻ qua WhatsApp.";
  }
}
