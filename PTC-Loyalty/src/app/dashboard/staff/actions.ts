"use server";

import crypto from "crypto";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireBusinessContext } from "@/lib/tenant";
import { hasAtLeast } from "@/lib/rbac";
import { toWhatsAppNumber } from "@/lib/phone";
import { renderStaffQrPng } from "@/lib/staff-qr";
import { staffDisplayName, staffNameSelect } from "@/lib/staff-name";
import { badgeSkipReason, sendStaffBadgeWhatsApp } from "@/lib/whatsapp/staff-badge";

/**
 * Quán có HAI loại người, khác nhau ở chỗ có đăng nhập hay không:
 *
 *   · NHÂN VIÊN — không có tài khoản, không bao giờ mở dashboard. Chỉ cần tên
 *     và số điện thoại. Thẻ chấm công gửi về WhatsApp, mọi thông báo (duyệt
 *     nghỉ, bảng công cuối tháng) cũng đi đường đó.
 *   · QUẢN LÝ — có email và mật khẩu để vào dashboard xếp ca, duyệt nghỉ.
 *
 * Vì vậy form thêm người đổi hình theo vai trò, và schema dưới đây kiểm hai bộ
 * điều kiện khác nhau chứ không bắt mọi người phải có email.
 */

const baseSchema = z.object({
  name: z.string().trim().min(2, "Nhập tên"),
  role: z.enum(["STAFF", "BUSINESS_MANAGER"]),
  // Số điện thoại là đường giao thẻ chấm công và mọi thông báo sau này.
  phone: z.string().trim().min(6, "Nhập số điện thoại (để gửi thẻ qua WhatsApp)"),
  branchId: z.string().optional(),
  departmentId: z.string().optional(),
  employeeNo: z.string().trim().max(30).optional(),
  maxPointsGrant: z.coerce.number().int().min(0).optional(),
  // Chỉ dùng khi vai trò là quản lý.
  email: z.string().trim().optional(),
  password: z.string().optional(),
});

export type AddStaffInput = z.infer<typeof baseSchema>;

export interface AddStaffResult {
  ok: boolean;
  error?: string;
  staffId?: string;
  /** Ảnh thẻ chấm công, hiện ngay sau khi tạo để quản lý in nếu muốn. */
  badgeDataUrl?: string;
  /** Đã bắn thẻ qua WhatsApp chưa, và nếu chưa thì vì sao. */
  whatsappSent?: boolean;
  whatsappNote?: string;
}

export async function addStaff(input: AddStaffInput): Promise<AddStaffResult> {
  const ctx = await requireBusinessContext();
  if (!hasAtLeast(ctx.role, "BUSINESS_MANAGER")) {
    return { ok: false, error: "Không có quyền." };
  }
  const parsed = baseSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message };
  const d = parsed.data;

  const wantsLogin = d.role === "BUSINESS_MANAGER";
  if (wantsLogin && !hasAtLeast(ctx.role, "BUSINESS_OWNER")) {
    return { ok: false, error: "Chỉ chủ quán mới được thêm quản lý." };
  }

  // Chặn ngay tại cửa: số không quy được về dạng quốc tế thì WhatsApp không bao
  // giờ tới nơi, mà lỗi lại chỉ lộ ra sau khi hồ sơ đã được tạo.
  if (!toWhatsAppNumber(d.phone)) {
    return { ok: false, error: "Số điện thoại không hợp lệ. Nhập dạng 0152… hoặc +49152…." };
  }

  let email = "";
  if (wantsLogin) {
    email = (d.email ?? "").toLowerCase();
    if (!z.string().email().safeParse(email).success) {
      return { ok: false, error: "Quản lý cần email hợp lệ để đăng nhập." };
    }
    if (!d.password || d.password.length < 8) {
      return { ok: false, error: "Mật khẩu tối thiểu 8 ký tự." };
    }
    if (await db.user.findUnique({ where: { email } })) {
      return { ok: false, error: "Email đã được sử dụng." };
    }
  }

  const [count, sub] = await Promise.all([
    db.staffProfile.count({ where: { businessId: ctx.businessId } }),
    db.subscription.findUnique({
      where: { businessId: ctx.businessId },
      include: { plan: true },
    }),
  ]);
  if (sub && count >= sub.plan.maxStaff) {
    return { ok: false, error: `Gói ${sub.plan.name} chỉ cho phép ${sub.plan.maxStaff} nhân viên.` };
  }

  const departmentId = d.departmentId && d.departmentId !== "none" ? d.departmentId : null;
  if (departmentId) {
    const dept = await db.department.findFirst({
      where: { id: departmentId, businessId: ctx.businessId },
      select: { id: true },
    });
    if (!dept) return { ok: false, error: "Không tìm thấy bộ phận." };
  }

  let staffId = "";
  try {
    await db.$transaction(async (tx) => {
      // Chỉ quản lý mới sinh ra một dòng User. Nhân viên thường không có tài
      // khoản nào cả — không email giả, không mật khẩu để quên.
      let userId: string | null = null;
      if (wantsLogin) {
        const user = await tx.user.create({
          data: {
            name: d.name,
            email,
            passwordHash: await bcrypt.hash(d.password as string, 10),
            role: d.role,
            emailVerified: new Date(),
          },
        });
        userId = user.id;
      }

      const profile = await tx.staffProfile.create({
        data: {
          businessId: ctx.businessId,
          userId,
          name: d.name,
          role: d.role,
          branchId: d.branchId || null,
          departmentId,
          phone: d.phone,
          employeeNo: d.employeeNo || null,
          maxPointsGrant: d.maxPointsGrant || null,
        },
      });
      staffId = profile.id;
    });
  } catch {
    // Ràng buộc duy nhất còn lại sau khi đã kiểm email: (businessId, employeeNo).
    return { ok: false, error: "Mã nhân viên này đã có người dùng." };
  }

  // Thẻ chấm công là MỘT PHẦN của việc nhận việc, không phải thao tác riêng làm
  // sau: sinh thẻ và bắn về WhatsApp ngay tại đây. Gửi hỏng KHÔNG huỷ hồ sơ —
  // thẻ vẫn còn, in hoặc gửi lại được.
  const created = await db.staffProfile.findUnique({
    where: { id: staffId },
    select: { qrSecret: true },
  });
  const badgeDataUrl = created
    ? (
        await renderStaffQrPng({
          businessId: ctx.businessId,
          staffProfileId: staffId,
          secret: created.qrSecret,
        })
      ).dataUrl
    : undefined;

  const sent = await sendStaffBadgeWhatsApp({
    businessId: ctx.businessId,
    staffProfileId: staffId,
  });

  revalidatePath("/dashboard/staff");
  return {
    ok: true,
    staffId,
    badgeDataUrl,
    whatsappSent: sent.ok,
    whatsappNote: sent.ok
      ? undefined
      : badgeSkipReason(sent.skipped) + " Thẻ đã cấp — in ra hoặc gửi lại sau.",
  };
}

/** Gửi lại thẻ chấm công qua WhatsApp (sau khi cấp thẻ mới, hoặc đổi số). */
export async function resendStaffBadge(
  staffId: string,
): Promise<{ ok: boolean; error?: string }> {
  const ctx = await requireBusinessContext();
  if (!hasAtLeast(ctx.role, "BUSINESS_MANAGER")) {
    return { ok: false, error: "Không có quyền." };
  }
  const sent = await sendStaffBadgeWhatsApp({
    businessId: ctx.businessId,
    staffProfileId: staffId,
  });
  if (sent.ok) return { ok: true };
  return { ok: false, error: sent.error ? "Gửi thất bại." : badgeSkipReason(sent.skipped) };
}

export async function toggleStaffActive(
  staffId: string,
): Promise<{ ok: boolean; error?: string }> {
  const ctx = await requireBusinessContext();
  if (!hasAtLeast(ctx.role, "BUSINESS_MANAGER")) {
    return { ok: false, error: "Không có quyền." };
  }
  const staff = await db.staffProfile.findUnique({ where: { id: staffId } });
  if (!staff || staff.businessId !== ctx.businessId) {
    return { ok: false, error: "Không tìm thấy nhân viên." };
  }
  if (staff.role === "BUSINESS_OWNER") {
    return { ok: false, error: "Không thể khóa chủ quán." };
  }
  await db.staffProfile.update({
    where: { id: staffId },
    data: { isActive: !staff.isActive },
  });
  revalidatePath("/dashboard/staff");
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// Nhân viên nghỉ việc
//
// Hai mức, cố ý tách ra vì hậu quả khác hẳn nhau:
//
//   CHO NGHỈ VIỆC  — thu hồi thẻ, gỡ ca chưa tới, đánh dấu ngừng làm. Giờ công
//                    đã làm VẪN CÒN nên còn tính được lương tháng cuối và còn
//                    tra lại được. Đây là thứ quán cần gần như mọi lần.
//   XOÁ VĨNH VIỄN  — xoá sạch cả người lẫn lịch sử chấm công của người đó.
//
// Cả hai đều bắt nhập lại mật khẩu của CHÍNH người đang thao tác: hành động
// không lấy lại được, mà máy trong quán thì thường để đăng nhập sẵn cả ngày,
// ai đi ngang cũng bấm được.
// ─────────────────────────────────────────────────────────────────────────────

/** Xác nhận mật khẩu của người đang đăng nhập. */
async function verifyOwnPassword(userId: string, password: string): Promise<boolean> {
  if (!password) return false;
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true },
  });
  if (!user?.passwordHash) return false;
  return bcrypt.compare(password, user.passwordHash);
}

/**
 * Kiểm tra chung cho cả hai mức: quyền, đúng quán, mật khẩu, và những người
 * KHÔNG được đụng tới — chủ quán (quán mất chủ thì không ai vào được nữa) và
 * chính mình (tự khoá mình xong thì không quay lại sửa được).
 */
async function guardStaffRemoval(staffId: string, password: string) {
  const ctx = await requireBusinessContext();
  if (!hasAtLeast(ctx.role, "BUSINESS_MANAGER")) {
    return { error: "Không có quyền." as const };
  }
  const staff = await db.staffProfile.findFirst({
    where: { id: staffId, businessId: ctx.businessId },
    select: { id: true, role: true, userId: true, ...staffNameSelect },
  });
  if (!staff) return { error: "Không tìm thấy nhân viên." as const };
  if (staff.role === "BUSINESS_OWNER") {
    return { error: "Không thể cho chủ quán nghỉ việc." as const };
  }
  if (staff.id === ctx.staffProfileId) {
    return { error: "Không thể tự cho mình nghỉ việc." as const };
  }
  if (staff.role === "BUSINESS_MANAGER" && !hasAtLeast(ctx.role, "BUSINESS_OWNER")) {
    return { error: "Chỉ chủ quán mới cho quản lý nghỉ việc được." as const };
  }
  if (!(await verifyOwnPassword(ctx.user.id, password))) {
    return { error: "Mật khẩu không đúng." as const };
  }
  return { ctx, staff };
}

export interface RemoveStaffResult {
  ok: boolean;
  error?: string;
  /** Tóm tắt những gì đã xảy ra, để báo lại cho người bấm nút. */
  summary?: string;
}

/**
 * Cho nghỉ việc: thu hồi thẻ chấm công, gỡ các ca CHƯA TỚI, ngừng hoạt động.
 * Ca đã làm và giờ công đã chấm giữ nguyên để còn tính lương tháng cuối.
 */
export async function offboardStaff(
  staffId: string,
  password: string,
): Promise<RemoveStaffResult> {
  const guard = await guardStaffRemoval(staffId, password);
  if ("error" in guard) return { ok: false, error: guard.error };
  const { ctx, staff } = guard;
  const name = staffDisplayName(staff);

  // Ca của hôm nay trở về trước là chuyện đã rồi, đừng đụng vào.
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const [, released] = await db.$transaction([
    db.staffProfile.update({
      where: { id: staff.id },
      data: {
        isActive: false,
        // Đổi nonce là mọi bản in cũ của thẻ chết ngay lập tức.
        qrSecret: crypto.randomUUID(),
      },
    }),
    db.shiftAssignment.updateMany({
      where: {
        businessId: ctx.businessId,
        staffId: staff.id,
        status: { not: "CANCELLED" },
        date: { gt: today },
      },
      data: { status: "CANCELLED" },
    }),
  ]);

  // Quản lý thì còn tài khoản để khoá; nhân viên thường không có gì để khoá.
  let lockedLogin = false;
  if (staff.userId) {
    const otherJobs = await db.staffProfile.count({
      where: { userId: staff.userId, isActive: true, NOT: { id: staff.id } },
    });
    if (otherJobs === 0) {
      await db.user.update({ where: { id: staff.userId }, data: { isActive: false } });
      lockedLogin = true;
    }
  }

  await db.auditLog.create({
    data: {
      businessId: ctx.businessId,
      userId: ctx.user.id,
      action: "STAFF_OFFBOARDED",
      entity: "StaffProfile",
      entityId: staff.id,
      metadata: { name, cancelledShifts: released.count, lockedLogin },
    },
  });

  revalidatePath("/dashboard/staff");
  revalidatePath("/dashboard/schedule");
  return {
    ok: true,
    summary:
      `Đã cho ${name} nghỉ việc. Thẻ chấm công bị thu hồi, ` +
      `${released.count} ca sắp tới đã gỡ khỏi lịch. ` +
      `Giờ công đã làm vẫn còn trong bảng công.`,
  };
}

/**
 * Xoá vĩnh viễn. Kéo theo hồ sơ, ca đã xếp và TOÀN BỘ lịch sử chấm công của
 * người đó (quan hệ khai onDelete: Cascade). Giao dịch tích điểm không mất —
 * cột staffId của giao dịch chỉ đặt về null.
 */
export async function deleteStaff(
  staffId: string,
  password: string,
): Promise<RemoveStaffResult> {
  const guard = await guardStaffRemoval(staffId, password);
  if ("error" in guard) return { ok: false, error: guard.error };
  const { ctx, staff } = guard;
  const name = staffDisplayName(staff);

  const [entries, shifts] = await Promise.all([
    db.timeEntry.count({ where: { staffId: staff.id } }),
    db.shiftAssignment.count({ where: { staffId: staff.id } }),
  ]);

  await db.auditLog.create({
    data: {
      businessId: ctx.businessId,
      userId: ctx.user.id,
      action: "STAFF_DELETED",
      entity: "StaffProfile",
      entityId: staff.id,
      // Ghi lại TRƯỚC khi xoá: sau đó thì không còn gì để đếm nữa.
      metadata: { name, deletedTimeEntries: entries, deletedShifts: shifts },
    },
  });

  await db.staffProfile.delete({ where: { id: staff.id } });

  if (staff.userId) {
    const otherJobs = await db.staffProfile.count({ where: { userId: staff.userId } });
    if (otherJobs === 0) {
      await db.user.delete({ where: { id: staff.userId } }).catch(() =>
        // Còn ràng buộc nào níu lại thì khoá tài khoản là đủ.
        db.user.update({ where: { id: staff.userId as string }, data: { isActive: false } }),
      );
    }
  }

  revalidatePath("/dashboard/staff");
  revalidatePath("/dashboard/schedule");
  revalidatePath("/dashboard/timesheet");
  return {
    ok: true,
    summary: `Đã xoá vĩnh viễn ${name}, kèm ${entries} lần chấm công và ${shifts} ca đã xếp.`,
  };
}
