"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireBusinessContext } from "@/lib/tenant";
import { hasAtLeast } from "@/lib/rbac";
import { absenceDayCount, dateKeyToUtcDate, utcDateToKey } from "@/lib/schedule";
import { notifyAbsenceDecision } from "@/lib/whatsapp/staff-notify";

export interface AbsenceState {
  ok?: boolean;
  error?: string;
  /** Đã lưu nhưng có việc quán phải xử lý tiếp, ví dụ phải xếp người thay ca. */
  warning?: string;
}

const reportSchema = z.object({
  staffId: z.string().min(1, "Chọn nhân viên"),
  type: z.enum(["SICK", "VACATION", "UNPAID", "TRAINING", "OTHER"]),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày bắt đầu không hợp lệ"),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày kết thúc không hợp lệ"),
  note: z.string().trim().max(500).optional(),
  hasCertificate: z.coerce.boolean().optional(),
});

/**
 * Báo nghỉ.
 *
 * Ốm và phép được đối xử KHÁC nhau, cố ý:
 *  - Báo ốm là THÔNG BÁO, không phải xin phép. Người ta ốm rồi, quán không có
 *    quyền "từ chối" — nên nó vào thẳng trạng thái đã duyệt và chặn xếp ca ngay.
 *  - Nghỉ phép là ĐỀ NGHỊ, phải chờ quản lý duyệt, vì nó đụng tới lịch cả quán.
 * Quản lý tự nhập thì luôn là đã duyệt, vì chính họ là người có quyền duyệt.
 */
export async function reportAbsence(
  _prev: AbsenceState,
  formData: FormData,
): Promise<AbsenceState> {
  const ctx = await requireBusinessContext();
  const isManager = hasAtLeast(ctx.role, "BUSINESS_MANAGER");

  const parsed = reportSchema.safeParse({
    staffId: formData.get("staffId"),
    type: formData.get("type") || "SICK",
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
    note: formData.get("note") || undefined,
    hasCertificate: formData.get("hasCertificate") === "on",
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." };
  }
  const input = parsed.data;

  // Nhân viên thường chỉ được báo nghỉ cho CHÍNH MÌNH. Không kiểm ở đây thì ai
  // cũng cho đồng nghiệp nghỉ ốm được.
  if (!isManager && input.staffId !== ctx.staffProfileId) {
    return { ok: false, error: "Bạn chỉ báo nghỉ được cho chính mình." };
  }

  const staff = await db.staffProfile.findFirst({
    where: { id: input.staffId, businessId: ctx.businessId },
    select: { id: true },
  });
  if (!staff) return { ok: false, error: "Không tìm thấy nhân viên trong quán này." };

  if (input.endDate < input.startDate) {
    return { ok: false, error: "Ngày kết thúc phải sau hoặc bằng ngày bắt đầu." };
  }
  const days = absenceDayCount({ startDateKey: input.startDate, endDateKey: input.endDate });
  if (days > 180) return { ok: false, error: "Kỳ nghỉ dài quá 180 ngày, chia nhỏ ra." };

  // Trùng kỳ nghỉ đã có thì chặn, tránh một ngày dính hai lần nghỉ.
  const overlapping = await db.staffAbsence.findFirst({
    where: {
      staffId: staff.id,
      status: { in: ["REQUESTED", "APPROVED"] },
      startDate: { lte: dateKeyToUtcDate(input.endDate) },
      endDate: { gte: dateKeyToUtcDate(input.startDate) },
    },
    select: { startDate: true, endDate: true },
  });
  if (overlapping) {
    return {
      ok: false,
      error: `Đã có kỳ nghỉ ${utcDateToKey(overlapping.startDate)} – ${utcDateToKey(overlapping.endDate)} trùng khoảng này.`,
    };
  }

  const autoApprove = isManager || input.type === "SICK";

  const absence = await db.staffAbsence.create({
    data: {
      businessId: ctx.businessId,
      staffId: staff.id,
      type: input.type,
      status: autoApprove ? "APPROVED" : "REQUESTED",
      startDate: dateKeyToUtcDate(input.startDate),
      endDate: dateKeyToUtcDate(input.endDate),
      note: input.note || null,
      hasCertificate: input.hasCertificate ?? false,
      reportedById: ctx.user.id,
      decidedById: autoApprove ? ctx.user.id : null,
      decidedAt: autoApprove ? new Date() : null,
    },
  });

  let warning: string | undefined;
  if (autoApprove) {
    const removed = await releaseShifts(absence.id, ctx.businessId);
    if (removed > 0) {
      warning = `Đã gỡ ${removed} ca đã xếp trong những ngày này — nhớ xếp người thay.`;
    }
  }
  // Ốm từ ngày thứ 3 trở đi ở Đức phải có giấy bác sĩ, nhắc luôn lúc nhập.
  if (input.type === "SICK" && days >= 3 && !input.hasCertificate) {
    warning = `${warning ? warning + " " : ""}Nghỉ ốm ${days} ngày cần giấy bác sĩ (AU-Bescheinigung).`;
  }

  // Nhân viên không có tài khoản nên WhatsApp là cách duy nhất họ biết mình
  // đã được cho nghỉ ngày nào. Gửi hỏng không được làm hỏng việc ghi nhận.
  await notifyAbsenceDecision({ absenceId: absence.id, businessId: ctx.businessId }).catch(
    () => undefined,
  );

  revalidatePath("/dashboard/absences");
  revalidatePath("/dashboard/schedule");
  return { ok: true, warning };
}

/**
 * Gỡ các ca đã xếp rơi vào kỳ nghỉ.
 *
 * Đánh dấu CANCELLED chứ không xoá: quản lý cần nhìn thấy ca đó từng tồn tại để
 * biết chỗ nào đang hổng người, và bảng công tháng trước không được đổi ngược.
 * Trả về số ca bị gỡ để chỗ gọi báo lại cho người dùng.
 */
async function releaseShifts(absenceId: string, businessId: string): Promise<number> {
  const absence = await db.staffAbsence.findFirst({
    where: { id: absenceId, businessId },
    select: { staffId: true, startDate: true, endDate: true },
  });
  if (!absence) return 0;

  const result = await db.shiftAssignment.updateMany({
    where: {
      businessId,
      staffId: absence.staffId,
      status: { not: "CANCELLED" },
      date: { gte: absence.startDate, lte: absence.endDate },
    },
    data: { status: "CANCELLED" },
  });
  return result.count;
}

const decideSchema = z.object({
  id: z.string().min(1),
  decision: z.enum(["APPROVED", "REJECTED", "CANCELLED"]),
});

/** Quản lý duyệt hoặc từ chối một đề nghị nghỉ. */
export async function decideAbsence(formData: FormData) {
  const ctx = await requireBusinessContext();
  if (!hasAtLeast(ctx.role, "BUSINESS_MANAGER")) return;

  const parsed = decideSchema.safeParse({
    id: formData.get("id"),
    decision: formData.get("decision"),
  });
  if (!parsed.success) return;

  const updated = await db.staffAbsence.updateMany({
    where: { id: parsed.data.id, businessId: ctx.businessId },
    data: {
      status: parsed.data.decision,
      decidedById: ctx.user.id,
      decidedAt: new Date(),
    },
  });
  if (updated.count === 0) return;

  if (parsed.data.decision === "APPROVED") {
    await releaseShifts(parsed.data.id, ctx.businessId);
  }

  // Báo kết quả về WhatsApp của nhân viên — nói rõ ngày nào, vì đây là thứ
  // quyết định mai họ có phải đi làm hay không.
  await notifyAbsenceDecision({ absenceId: parsed.data.id, businessId: ctx.businessId }).catch(
    () => undefined,
  );

  revalidatePath("/dashboard/absences");
  revalidatePath("/dashboard/schedule");
}

/** Đánh dấu đã nộp giấy bác sĩ. */
export async function markCertificate(formData: FormData) {
  const ctx = await requireBusinessContext();
  if (!hasAtLeast(ctx.role, "BUSINESS_MANAGER")) return;
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await db.staffAbsence.updateMany({
    where: { id, businessId: ctx.businessId },
    data: { hasCertificate: true },
  });
  revalidatePath("/dashboard/absences");
}
