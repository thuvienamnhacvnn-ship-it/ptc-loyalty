"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireBusinessContext } from "@/lib/tenant";
import { hasAtLeast } from "@/lib/rbac";
import { adjustPoints } from "@/lib/transactions";
import { generateMemberCode } from "@/lib/utils";

export interface FormResult {
  ok: boolean;
  error?: string;
}

const adjustSchema = z.object({
  customerId: z.string().min(1),
  pointsDelta: z.coerce.number().int().refine((n) => n !== 0, "Nhập số điểm khác 0"),
  reason: z.string().trim().min(3, "Nhập lý do (tối thiểu 3 ký tự)"),
});

export async function adjustCustomerPoints(
  input: z.infer<typeof adjustSchema>,
): Promise<FormResult> {
  const ctx = await requireBusinessContext();
  // Only managers/owners may adjust points manually.
  if (!hasAtLeast(ctx.role, "BUSINESS_MANAGER")) {
    return { ok: false, error: "Bạn không có quyền điều chỉnh điểm." };
  }
  const parsed = adjustSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message };
  }

  const result = await adjustPoints({
    ctx,
    customerId: parsed.data.customerId,
    pointsDelta: parsed.data.pointsDelta,
    reason: parsed.data.reason,
  });
  if (!result.ok) return { ok: false, error: "Điều chỉnh thất bại." };
  revalidatePath(`/dashboard/customers/${parsed.data.customerId}`);
  return { ok: true };
}

export async function toggleBlockCustomer(customerId: string): Promise<FormResult> {
  const ctx = await requireBusinessContext();
  if (!hasAtLeast(ctx.role, "BUSINESS_MANAGER")) {
    return { ok: false, error: "Không có quyền." };
  }
  const customer = await db.customerProfile.findUnique({ where: { id: customerId } });
  if (!customer || customer.businessId !== ctx.businessId) {
    return { ok: false, error: "Không tìm thấy khách hàng." };
  }
  await db.customerProfile.update({
    where: { id: customerId },
    data: { isBlocked: !customer.isBlocked },
  });
  await db.auditLog.create({
    data: {
      businessId: ctx.businessId,
      userId: ctx.user.id,
      action: customer.isBlocked ? "customer.unblock" : "customer.block",
      entity: "CustomerProfile",
      entityId: customerId,
    },
  });
  revalidatePath(`/dashboard/customers/${customerId}`);
  return { ok: true };
}

/** GDPR anonymization: strips PII while keeping aggregate stats. */
export async function anonymizeCustomer(customerId: string): Promise<FormResult> {
  const ctx = await requireBusinessContext();
  if (!hasAtLeast(ctx.role, "BUSINESS_OWNER")) {
    return { ok: false, error: "Chỉ chủ doanh nghiệp mới được ẩn danh dữ liệu." };
  }
  const customer = await db.customerProfile.findUnique({ where: { id: customerId } });
  if (!customer || customer.businessId !== ctx.businessId) {
    return { ok: false, error: "Không tìm thấy khách hàng." };
  }
  await db.customerProfile.update({
    where: { id: customerId },
    data: {
      firstName: "Đã ẩn danh",
      lastName: null,
      email: null,
      phone: null,
      birthDate: null,
      gender: null,
      userId: null,
      isAnonymized: true,
      marketingConsent: false,
    },
  });
  await db.auditLog.create({
    data: {
      businessId: ctx.businessId,
      userId: ctx.user.id,
      action: "customer.anonymize",
      entity: "CustomerProfile",
      entityId: customerId,
    },
  });
  revalidatePath(`/dashboard/customers/${customerId}`);
  return { ok: true };
}

const createSchema = z.object({
  firstName: z.string().trim().min(1, "Nhập tên"),
  lastName: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  email: z.string().email("Email không hợp lệ").optional().or(z.literal("")),
  marketingConsent: z.coerce.boolean().optional(),
});

export async function createCustomer(
  input: z.infer<typeof createSchema>,
): Promise<FormResult> {
  const ctx = await requireBusinessContext();
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message };
  }
  const d = parsed.data;
  await db.customerProfile.create({
    data: {
      businessId: ctx.businessId,
      memberCode: generateMemberCode(),
      firstName: d.firstName,
      lastName: d.lastName || null,
      phone: d.phone || null,
      email: d.email || null,
      marketingConsent: !!d.marketingConsent,
    },
  });
  revalidatePath("/dashboard/customers");
  return { ok: true };
}
