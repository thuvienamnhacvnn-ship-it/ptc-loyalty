"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireBusinessContext } from "@/lib/tenant";
import { hasAtLeast } from "@/lib/rbac";

const schema = z.object({
  name: z.string().trim().min(2, "Nhập tên"),
  email: z.string().email("Email không hợp lệ"),
  password: z.string().min(8, "Mật khẩu tối thiểu 8 ký tự"),
  role: z.enum(["STAFF", "BUSINESS_MANAGER"]),
  branchId: z.string().optional(),
  maxPointsGrant: z.coerce.number().int().min(0).optional(),
});

export async function addStaff(
  input: z.infer<typeof schema>,
): Promise<{ ok: boolean; error?: string }> {
  const ctx = await requireBusinessContext();
  // Only owners can add managers; managers can add staff only.
  if (!hasAtLeast(ctx.role, "BUSINESS_MANAGER")) {
    return { ok: false, error: "Không có quyền." };
  }
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message };
  const d = parsed.data;

  if (d.role === "BUSINESS_MANAGER" && !hasAtLeast(ctx.role, "BUSINESS_OWNER")) {
    return { ok: false, error: "Chỉ chủ doanh nghiệp mới được thêm quản lý." };
  }

  const [count, sub, emailTaken] = await Promise.all([
    db.staffProfile.count({ where: { businessId: ctx.businessId } }),
    db.subscription.findUnique({
      where: { businessId: ctx.businessId },
      include: { plan: true },
    }),
    db.user.findUnique({ where: { email: d.email.toLowerCase() } }),
  ]);
  if (sub && count >= sub.plan.maxStaff) {
    return { ok: false, error: `Gói ${sub.plan.name} chỉ cho phép ${sub.plan.maxStaff} nhân viên.` };
  }
  if (emailTaken) return { ok: false, error: "Email đã được sử dụng." };

  const passwordHash = await bcrypt.hash(d.password, 10);
  await db.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name: d.name,
        email: d.email.toLowerCase(),
        passwordHash,
        role: d.role,
        emailVerified: new Date(),
      },
    });
    await tx.staffProfile.create({
      data: {
        businessId: ctx.businessId,
        userId: user.id,
        role: d.role,
        branchId: d.branchId || null,
        maxPointsGrant: d.maxPointsGrant || null,
      },
    });
  });
  revalidatePath("/dashboard/staff");
  return { ok: true };
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
    return { ok: false, error: "Không thể khóa chủ doanh nghiệp." };
  }
  await db.staffProfile.update({
    where: { id: staffId },
    data: { isActive: !staff.isActive },
  });
  revalidatePath("/dashboard/staff");
  return { ok: true };
}
