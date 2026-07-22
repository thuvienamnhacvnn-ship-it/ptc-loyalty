"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireBusinessContext, requireUser } from "@/lib/tenant";
import { hasAtLeast } from "@/lib/rbac";

export interface FormResult {
  ok: boolean;
  error?: string;
}

// ── Account security: change password (while signed in) ──────────────────────

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Nhập mật khẩu hiện tại"),
  newPassword: z.string().min(8, "Mật khẩu mới tối thiểu 8 ký tự"),
});

export async function changePassword(input: {
  currentPassword: string;
  newPassword: string;
}): Promise<FormResult> {
  const sessionUser = await requireUser();
  const parsed = changePasswordSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message };
  }
  const { currentPassword, newPassword } = parsed.data;

  const user = await db.user.findUnique({
    where: { id: sessionUser.id },
    select: { passwordHash: true },
  });
  if (!user?.passwordHash) {
    return { ok: false, error: "Tài khoản chưa đặt mật khẩu." };
  }

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) return { ok: false, error: "Mật khẩu hiện tại không đúng." };
  if (currentPassword === newPassword) {
    return { ok: false, error: "Mật khẩu mới phải khác mật khẩu cũ." };
  }

  // New hash applies to BOTH web and desktop (POS) login.
  const passwordHash = await bcrypt.hash(newPassword, 10);
  await db.user.update({
    where: { id: sessionUser.id },
    data: { passwordHash },
  });
  return { ok: true };
}

const loyaltySchema = z.object({
  amountPerPoint: z.coerce.number().positive(),
  pointsPerUnit: z.coerce.number().int().positive(),
  rounding: z.enum(["floor", "round", "ceil"]),
  minPointsPerTxn: z.coerce.number().int().min(0),
  maxPointsPerTxn: z.coerce.number().int().min(0).optional(),
  signupBonus: z.coerce.number().int().min(0),
  birthdayBonus: z.coerce.number().int().min(0),
  referralBonus: z.coerce.number().int().min(0),
  pointsExpiryDays: z.coerce.number().int().min(0).optional(),
});

export async function saveLoyaltySettings(
  input: z.infer<typeof loyaltySchema>,
): Promise<FormResult> {
  const ctx = await requireBusinessContext();
  if (!hasAtLeast(ctx.role, "BUSINESS_MANAGER")) {
    return { ok: false, error: "Không có quyền." };
  }
  const parsed = loyaltySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message };
  const d = parsed.data;

  await db.businessSetting.update({
    where: { businessId: ctx.businessId },
    data: {
      amountPerPoint: d.amountPerPoint,
      pointsPerUnit: d.pointsPerUnit,
      rounding: d.rounding,
      minPointsPerTxn: d.minPointsPerTxn,
      maxPointsPerTxn: d.maxPointsPerTxn || null,
      signupBonus: d.signupBonus,
      birthdayBonus: d.birthdayBonus,
      referralBonus: d.referralBonus,
      pointsExpiryDays: d.pointsExpiryDays || null,
    },
  });
  revalidatePath("/dashboard/loyalty");
  return { ok: true };
}

const profileSchema = z.object({
  name: z.string().trim().min(2),
  phone: z.string().trim().optional(),
  addressLine: z.string().trim().optional(),
  city: z.string().trim().optional(),
  locale: z.enum(["vi", "de", "en"]),
});

export async function saveBusinessProfile(
  input: z.infer<typeof profileSchema>,
): Promise<FormResult> {
  const ctx = await requireBusinessContext();
  if (!hasAtLeast(ctx.role, "BUSINESS_OWNER")) {
    return { ok: false, error: "Chỉ chủ doanh nghiệp được sửa hồ sơ." };
  }
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message };
  const d = parsed.data;

  await db.business.update({
    where: { id: ctx.businessId },
    data: {
      name: d.name,
      phone: d.phone || null,
      addressLine: d.addressLine || null,
      city: d.city || null,
      locale: d.locale,
    },
  });
  revalidatePath("/dashboard/settings");
  return { ok: true };
}

const brandingSchema = z.object({
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  logoUrl: z.string().url().optional().or(z.literal("")),
});

export async function saveBranding(
  input: z.infer<typeof brandingSchema>,
): Promise<FormResult> {
  const ctx = await requireBusinessContext();
  if (!hasAtLeast(ctx.role, "BUSINESS_OWNER")) {
    return { ok: false, error: "Không có quyền." };
  }
  const parsed = brandingSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Màu không hợp lệ." };
  const d = parsed.data;
  await db.businessBranding.update({
    where: { businessId: ctx.businessId },
    data: {
      primaryColor: d.primaryColor,
      accentColor: d.accentColor,
      logoUrl: d.logoUrl || null,
    },
  });
  revalidatePath("/dashboard/settings");
  return { ok: true };
}
