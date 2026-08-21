import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { hasAtLeast } from "@/lib/rbac";
import type { PosContext } from "@/lib/pos/context";
import type { PosStaff } from "@/lib/pos/contract";
import { staffDisplayName, staffNameSelect } from "@/lib/staff-name";

// POS admin operations (staff / tiers / loyalty / campaigns), mirroring the web
// dashboard's server actions but driven by the POS bearer context. Every write
// is role-gated (hasAtLeast) and tenant-scoped via ctx.businessId.

export type AdminResult = { ok: true } | { ok: false; error: string };

// ── Staff ────────────────────────────────────────────────────────────────────

export async function listPosStaff(ctx: PosContext): Promise<PosStaff[]> {
  const rows = await db.staffProfile.findMany({
    where: { businessId: ctx.businessId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      role: true,
      branchId: true,
      maxPointsGrant: true,
      isActive: true,
      lastLoginAt: true,
      ...staffNameSelect,
      branch: { select: { name: true } },
    },
  });
  return rows.map((s) => ({
    id: s.id,
    name: staffDisplayName(s),
    // Nhân viên thường không có tài khoản nên không có email.
    email: s.user?.email ?? null,
    role: s.role,
    branchId: s.branchId,
    branchName: s.branch?.name ?? null,
    maxPointsGrant: s.maxPointsGrant,
    isActive: s.isActive,
    lastLoginAt: s.lastLoginAt ? s.lastLoginAt.toISOString() : null,
  }));
}

const addStaffSchema = z.object({
  name: z.string().trim().min(2, "Nhập tên"),
  email: z.string().email("Email không hợp lệ"),
  password: z.string().min(8, "Mật khẩu tối thiểu 8 ký tự"),
  role: z.enum(["STAFF", "BUSINESS_MANAGER"]),
  branchId: z.string().optional().nullable(),
  maxPointsGrant: z.coerce.number().int().min(0).optional().nullable(),
});

export async function addPosStaff(
  ctx: PosContext,
  input: unknown,
): Promise<AdminResult> {
  if (!hasAtLeast(ctx.role, "BUSINESS_MANAGER")) return { ok: false, error: "Không có quyền." };
  const parsed = addStaffSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." };
  const d = parsed.data;

  // Only owners may add managers.
  if (d.role === "BUSINESS_MANAGER" && !hasAtLeast(ctx.role, "BUSINESS_OWNER")) {
    return { ok: false, error: "Chỉ chủ doanh nghiệp mới được thêm quản lý." };
  }

  const [count, sub, emailTaken] = await Promise.all([
    db.staffProfile.count({ where: { businessId: ctx.businessId } }),
    db.subscription.findUnique({ where: { businessId: ctx.businessId }, include: { plan: true } }),
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
  return { ok: true };
}

export async function togglePosStaffActive(
  ctx: PosContext,
  staffId: string,
): Promise<AdminResult> {
  if (!hasAtLeast(ctx.role, "BUSINESS_MANAGER")) return { ok: false, error: "Không có quyền." };
  const staff = await db.staffProfile.findFirst({
    where: { id: staffId, businessId: ctx.businessId },
  });
  if (!staff) return { ok: false, error: "Không tìm thấy nhân viên." };
  if (staff.role === "BUSINESS_OWNER") return { ok: false, error: "Không thể khóa chủ doanh nghiệp." };
  await db.staffProfile.update({ where: { id: staffId }, data: { isActive: !staff.isActive } });
  return { ok: true };
}
