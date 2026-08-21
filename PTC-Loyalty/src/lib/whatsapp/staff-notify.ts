import { db } from "@/lib/db";
import { toWhatsAppNumber } from "@/lib/phone";
import { staffDisplayName, staffNameSelect } from "@/lib/staff-name";
import { formatDuration } from "@/lib/worktime";
import { utcDateToKey } from "@/lib/schedule";
import { resolveSessionOrReason } from "./connection";
import type { SendResult } from "./providers/types";

/**
 * Thông báo gửi cho NHÂN VIÊN qua WhatsApp.
 *
 * Nhân viên không có tài khoản, không mở dashboard bao giờ, nên WhatsApp là
 * kênh DUY NHẤT họ biết chuyện gì đang xảy ra với lịch và công của mình:
 *   · quản lý duyệt hoặc từ chối đơn nghỉ,
 *   · quán ghi nhận họ nghỉ những ngày nào,
 *   · cuối tháng: đã làm bao nhiêu ngày, nghỉ bao nhiêu ngày, tổng bao nhiêu giờ.
 *
 * Mọi hàm ở đây đều IM LẶNG BỎ QUA khi không gửi được. Duyệt nghỉ không bao giờ
 * được fail chỉ vì quán chưa ghép số WhatsApp.
 */

export interface NotifyResult {
  ok: boolean;
  skipped?: string;
  error?: string;
}

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
        customerId: null, // người nhận là nhân viên, không phải khách
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
    console.error("[staff-notify] log write failed:", e instanceof Error ? e.message : e);
  }
}

/** Gửi một tin nhắn chữ cho nhân viên. Dùng chung cho mọi loại thông báo. */
async function sendToStaff(input: {
  businessId: string;
  staffProfileId: string;
  templateKey: string;
  text: string;
}): Promise<NotifyResult> {
  try {
    const staff = await db.staffProfile.findFirst({
      where: { id: input.staffProfileId, businessId: input.businessId },
      select: { id: true, phone: true },
    });
    if (!staff) return { ok: false, skipped: "no_staff" };

    const phone = toWhatsAppNumber(staff.phone);
    if (!phone) return { ok: false, skipped: "no_phone" };

    const attempt = await resolveSessionOrReason(input.businessId);
    if (!attempt.ok) return { ok: false, skipped: attempt.reason };

    const result = await attempt.value.provider.sendText(
      attempt.value.session,
      phone,
      input.text,
    );
    await logSend({
      businessId: input.businessId,
      staffProfileId: staff.id,
      toPhone: phone,
      templateKey: input.templateKey,
      text: input.text,
      result,
    });
    return result.ok ? { ok: true } : { ok: false, error: result.error };
  } catch (e) {
    console.error("[staff-notify] send failed:", e instanceof Error ? e.message : e);
    return { ok: false, error: "exception" };
  }
}

const TYPE_WORDS: Record<string, string> = {
  SICK: "nghỉ ốm",
  VACATION: "nghỉ phép",
  UNPAID: "nghỉ không lương",
  TRAINING: "đi đào tạo",
  OTHER: "nghỉ",
};

/** "2026-08-24" → "24.08.2026" — người Đức và người Việt đều đọc được. */
function viDate(dateKey: string): string {
  const [y, m, d] = dateKey.split("-");
  return `${d}.${m}.${y}`;
}

/** Khoảng ngày: một ngày thì nói một ngày, nhiều ngày thì nói từ–đến. */
function rangeText(fromKey: string, toKey: string, days: number): string {
  return fromKey === toKey
    ? `ngày ${viDate(fromKey)}`
    : `từ ${viDate(fromKey)} đến hết ${viDate(toKey)} (${days} ngày)`;
}

/**
 * Báo kết quả duyệt đơn nghỉ.
 *
 * Đây là tin quan trọng nhất trong cả module với nhân viên: nó quyết định mai
 * họ có phải đi làm hay không. Nên câu chữ phải nói rõ NGÀY NÀO, chứ không chỉ
 * "đơn của bạn đã được duyệt".
 */
export async function notifyAbsenceDecision(input: {
  absenceId: string;
  businessId: string;
}): Promise<NotifyResult> {
  const absence = await db.staffAbsence.findFirst({
    where: { id: input.absenceId, businessId: input.businessId },
    include: {
      staff: { select: { id: true, ...staffNameSelect } },
      business: { select: { name: true } },
    },
  });
  if (!absence) return { ok: false, skipped: "no_absence" };

  const fromKey = utcDateToKey(absence.startDate);
  const toKey = utcDateToKey(absence.endDate);
  const days =
    Math.round(
      (absence.endDate.getTime() - absence.startDate.getTime()) / 86_400_000,
    ) + 1;
  const name = staffDisplayName(absence.staff);
  const word = TYPE_WORDS[absence.type] ?? "nghỉ";
  const when = rangeText(fromKey, toKey, days);

  let text: string;
  switch (absence.status) {
    case "APPROVED":
      text =
        `Chào ${name}, ${absence.business.name} đã DUYỆT đơn ${word} của bạn ${when}.\n\n` +
        `Những ngày này bạn không có ca, không cần tới quán và không cần quét thẻ. ` +
        `Lịch làm của bạn đã được cập nhật.` +
        (absence.type === "SICK" && days >= 3 && !absence.hasCertificate
          ? `\n\nNhớ nộp giấy bác sĩ (AU-Bescheinigung) cho quản lý — nghỉ ốm từ 3 ngày là bắt buộc.`
          : "");
      break;
    case "REJECTED":
      text =
        `Chào ${name}, ${absence.business.name} chưa duyệt đơn ${word} ${when} của bạn.\n\n` +
        `Bạn vẫn giữ ca như lịch cũ. Liên hệ quản lý để trao đổi thêm.`;
      break;
    case "CANCELLED":
      text = `Chào ${name}, đơn ${word} ${when} của bạn tại ${absence.business.name} đã được huỷ.`;
      break;
    default:
      // REQUESTED: quản lý mới nhập hộ, chưa quyết — xác nhận đã ghi nhận.
      text =
        `Chào ${name}, ${absence.business.name} đã ghi nhận đề nghị ${word} ${when} của bạn. ` +
        `Quản lý sẽ trả lời sớm.`;
  }

  return sendToStaff({
    businessId: input.businessId,
    staffProfileId: absence.staff.id,
    templateKey: `staff_absence_${absence.status.toLowerCase()}`,
    text,
  });
}

export interface MonthlySummaryInput {
  businessId: string;
  staffProfileId: string;
  monthLabel: string; // "8/2026"
  workedDays: number;
  absenceDays: number;
  workedMin: number;
  plannedMin: number;
  lateCount: number;
  /** Số ca có lịch mà không thấy chấm công — nhân viên nên biết mà báo lại. */
  missingCount: number;
}

/**
 * Bảng tổng kết cuối tháng.
 *
 * Gửi cho nhân viên CON SỐ, không gửi ý kiến: đi làm mấy ngày, nghỉ mấy ngày,
 * tổng bao nhiêu giờ. Kèm một câu mời đối chiếu — sai sót về giờ công phát hiện
 * ngay cuối tháng thì sửa được, để tới lúc nhận lương mới cãi nhau thì muộn.
 */
export async function notifyMonthlySummary(input: MonthlySummaryInput): Promise<NotifyResult> {
  const staff = await db.staffProfile.findFirst({
    where: { id: input.staffProfileId, businessId: input.businessId },
    select: { id: true, ...staffNameSelect, business: { select: { name: true } } },
  });
  if (!staff) return { ok: false, skipped: "no_staff" };

  const name = staffDisplayName(staff);
  const diff = input.workedMin - input.plannedMin;

  const lines = [
    `Chào ${name}, tổng kết tháng ${input.monthLabel} tại ${staff.business.name}:`,
    ``,
    `• Số ngày đi làm: ${input.workedDays}`,
    `• Số ngày nghỉ: ${input.absenceDays}`,
    `• Tổng giờ công: ${formatDuration(input.workedMin)}`,
  ];
  if (input.plannedMin > 0) {
    lines.push(
      `• So với lịch đã xếp: ${diff === 0 ? "vừa đúng" : `${diff > 0 ? "hơn" : "thiếu"} ${formatDuration(Math.abs(diff))}`}`,
    );
  }
  if (input.lateCount > 0) lines.push(`• Số lần đi muộn: ${input.lateCount}`);
  if (input.missingCount > 0) {
    lines.push(`• Có ${input.missingCount} ca không thấy bạn quét thẻ — báo quản lý nếu sai.`);
  }
  lines.push(``, `Thấy số nào chưa đúng thì nhắn quản lý ngay trong tuần này nhé.`);

  return sendToStaff({
    businessId: input.businessId,
    staffProfileId: staff.id,
    templateKey: "staff_monthly_summary",
    text: lines.join("\n"),
  });
}
