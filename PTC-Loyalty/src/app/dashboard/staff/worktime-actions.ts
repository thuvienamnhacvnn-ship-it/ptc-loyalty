"use server";

import crypto from "crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireBusinessContext } from "@/lib/tenant";
import { hasAtLeast } from "@/lib/rbac";
import { renderStaffQrPng } from "@/lib/staff-qr";
import { staffDisplayName, staffNameSelect } from "@/lib/staff-name";

/**
 * Phần hồ sơ nhân viên phục vụ chấm công: thẻ QR, bộ phận, mã nhân viên, lương.
 * Tách khỏi `actions.ts` vì file kia lo tài khoản và phân quyền — hai chuyện
 * đổi vì hai lý do khác nhau.
 */

export interface StaffQrPayload {
  ok: boolean;
  error?: string;
  name?: string;
  employeeNo?: string | null;
  departmentName?: string | null;
  businessName?: string;
  dataUrl?: string;
}

/** Vẽ thẻ chấm công của một nhân viên để in. */
export async function getStaffBadge(staffId: string): Promise<StaffQrPayload> {
  const ctx = await requireBusinessContext();
  if (!hasAtLeast(ctx.role, "BUSINESS_MANAGER")) {
    return { ok: false, error: "Chỉ quản lý mới in được thẻ." };
  }

  const staff = await db.staffProfile.findFirst({
    where: { id: staffId, businessId: ctx.businessId },
    select: {
      id: true,
      qrSecret: true,
      employeeNo: true,
      ...staffNameSelect,
      department: { select: { name: true } },
      business: { select: { name: true } },
    },
  });
  if (!staff) return { ok: false, error: "Không tìm thấy nhân viên." };

  const { dataUrl } = await renderStaffQrPng({
    businessId: ctx.businessId,
    staffProfileId: staff.id,
    secret: staff.qrSecret,
  });

  return {
    ok: true,
    name: staffDisplayName(staff),
    employeeNo: staff.employeeNo,
    departmentName: staff.department?.name ?? null,
    businessName: staff.business.name,
    dataUrl,
  };
}

/**
 * Thu hồi thẻ cũ và cấp thẻ mới.
 *
 * Thẻ chấm công không hết hạn nên đây là cách duy nhất chặn một tấm thẻ đã mất.
 * Đổi `qrSecret` là mọi bản in cũ chết ngay lập tức, kể cả bản người khác đã
 * chụp ảnh lại.
 */
export async function revokeStaffBadge(formData: FormData) {
  const ctx = await requireBusinessContext();
  if (!hasAtLeast(ctx.role, "BUSINESS_MANAGER")) return;
  const staffId = String(formData.get("staffId") ?? "");
  if (!staffId) return;

  await db.staffProfile.updateMany({
    where: { id: staffId, businessId: ctx.businessId },
    data: { qrSecret: crypto.randomUUID() },
  });
  revalidatePath("/dashboard/staff");
}

const profileSchema = z.object({
  staffId: z.string().min(1),
  departmentId: z.string().optional(),
  employeeNo: z.string().trim().max(30).optional(),
  phone: z.string().trim().max(30).optional(),
  weeklyHours: z.string().optional(),
  hourlyWage: z.string().optional(),
});

export interface StaffProfileState {
  ok?: boolean;
  error?: string;
}

/** Sửa phần hồ sơ liên quan tới ca và lương. */
export async function updateStaffWorkProfile(
  _prev: StaffProfileState,
  formData: FormData,
): Promise<StaffProfileState> {
  const ctx = await requireBusinessContext();
  if (!hasAtLeast(ctx.role, "BUSINESS_MANAGER")) {
    return { ok: false, error: "Không có quyền." };
  }

  const parsed = profileSchema.safeParse({
    staffId: formData.get("staffId"),
    departmentId: formData.get("departmentId") || undefined,
    employeeNo: formData.get("employeeNo") || undefined,
    phone: formData.get("phone") || undefined,
    weeklyHours: formData.get("weeklyHours") || undefined,
    hourlyWage: formData.get("hourlyWage") || undefined,
  });
  if (!parsed.success) return { ok: false, error: "Dữ liệu không hợp lệ." };
  const input = parsed.data;

  const staff = await db.staffProfile.findFirst({
    where: { id: input.staffId, businessId: ctx.businessId },
    select: { id: true },
  });
  if (!staff) return { ok: false, error: "Không tìm thấy nhân viên." };

  const departmentId =
    input.departmentId && input.departmentId !== "none" ? input.departmentId : null;
  if (departmentId) {
    const dept = await db.department.findFirst({
      where: { id: departmentId, businessId: ctx.businessId },
      select: { id: true },
    });
    if (!dept) return { ok: false, error: "Không tìm thấy bộ phận." };
  }

  const weeklyHours = parseDecimal(input.weeklyHours);
  if (weeklyHours !== null && (weeklyHours < 0 || weeklyHours > 80)) {
    return { ok: false, error: "Giờ cam kết mỗi tuần phải trong khoảng 0–80." };
  }
  const wage = parseDecimal(input.hourlyWage);
  if (wage !== null && (wage < 0 || wage > 500)) {
    return { ok: false, error: "Lương giờ không hợp lý." };
  }

  // Chỉ chủ quán được sửa lương; quản lý sửa mấy thứ còn lại thì giữ nguyên lương.
  const canSetWage = hasAtLeast(ctx.role, "BUSINESS_OWNER");

  try {
    await db.staffProfile.update({
      where: { id: staff.id },
      data: {
        departmentId,
        employeeNo: input.employeeNo || null,
        phone: input.phone || null,
        weeklyHours,
        ...(canSetWage ? { hourlyWageCents: wage === null ? null : Math.round(wage * 100) } : {}),
      },
    });
  } catch {
    // Ràng buộc duy nhất trên (businessId, employeeNo).
    return { ok: false, error: "Mã nhân viên này đã có người dùng." };
  }

  revalidatePath("/dashboard/staff");
  revalidatePath("/dashboard/schedule");
  return { ok: true };
}

/** "8,5" và "8.5" đều ra 8.5. Người Đức gõ dấu phẩy, người Việt gõ dấu chấm. */
function parseDecimal(value: string | undefined): number | null {
  if (!value || !value.trim()) return null;
  const n = Number(value.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}
