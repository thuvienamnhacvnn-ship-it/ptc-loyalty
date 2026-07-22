"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireBusinessContext } from "@/lib/tenant";
import { hasAtLeast } from "@/lib/rbac";
import { adjustPoints } from "@/lib/transactions";
import { generateMemberCode } from "@/lib/utils";
import { renderMemberQrPng } from "@/lib/member-qr";
import { sendMemberCardWhatsApp } from "@/lib/whatsapp/membership-card";
import { findCustomerConflict } from "@/lib/customer-dedup";

export interface FormResult {
  ok: boolean;
  error?: string;
}

export type CustomerQrResult =
  | { ok: true; dataUrl: string; token: string; memberCode: string; name: string }
  | { ok: false; error: string };

/** Fixed membership QR (PNG data URL) for a customer — staff view/print. */
export async function customerQrDataUrl(customerId: string): Promise<CustomerQrResult> {
  const ctx = await requireBusinessContext();
  const c = await db.customerProfile.findFirst({
    where: { id: customerId, businessId: ctx.businessId },
    select: { id: true, memberCode: true, qrSecret: true, firstName: true, lastName: true },
  });
  if (!c) return { ok: false, error: "Không tìm thấy khách hàng." };

  const { token, dataUrl } = await renderMemberQrPng({
    businessId: ctx.businessId,
    customerId: c.id,
    memberCode: c.memberCode,
    secret: c.qrSecret,
  });
  return {
    ok: true,
    dataUrl,
    token,
    memberCode: c.memberCode,
    name: `${c.firstName} ${c.lastName ?? ""}`.trim(),
  };
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
  birthDate: z.string().trim().optional(), // yyyy-mm-dd from a date input
  marketingConsent: z.coerce.boolean().optional(),
});

export async function createCustomer(
  input: z.infer<typeof createSchema>,
): Promise<FormResult & { customerId?: string; whatsapp?: string }> {
  const ctx = await requireBusinessContext();
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message };
  }
  const d = parsed.data;
  const birthDate = d.birthDate ? new Date(d.birthDate) : null;

  // Reject duplicate phone / email within this business.
  const conflict = await findCustomerConflict(ctx.businessId, { phone: d.phone, email: d.email });
  if (conflict === "phone") return { ok: false, error: "Số điện thoại này đã được đăng ký." };
  if (conflict === "email") return { ok: false, error: "Email này đã được đăng ký." };

  // memberCode + qrSecret (schema default cuid) are generated automatically, so
  // every new customer immediately has a unique, fixed membership QR.
  const created = await db.customerProfile.create({
    data: {
      businessId: ctx.businessId,
      memberCode: generateMemberCode(),
      firstName: d.firstName,
      lastName: d.lastName || null,
      phone: d.phone || null,
      email: d.email || null,
      birthDate: birthDate && !Number.isNaN(birthDate.getTime()) ? birthDate : null,
      marketingConsent: !!d.marketingConsent,
    },
    select: { id: true, memberCode: true, qrSecret: true, firstName: true, lastName: true },
  });
  revalidatePath("/dashboard/customers");

  // Auto-send the QR membership card over WhatsApp (never fails signup).
  let whatsapp: string | undefined;
  if (d.phone) {
    const biz = await db.business.findUnique({
      where: { id: ctx.businessId },
      select: { name: true },
    });
    const sent = await sendMemberCardWhatsApp({
      businessId: ctx.businessId,
      customerId: created.id,
      memberCode: created.memberCode,
      qrSecret: created.qrSecret,
      name: `${created.firstName} ${created.lastName ?? ""}`.trim(),
      storeName: biz?.name ?? "PTC Loyalty",
      toPhone: d.phone,
    });
    whatsapp = sent.ok ? "sent" : sent.skipped ?? sent.error;
  }

  return { ok: true, customerId: created.id, whatsapp };
}

// ── Edit customer ─────────────────────────────────────────────────────────────

const updateSchema = z.object({
  customerId: z.string().min(1),
  firstName: z.string().trim().min(1, "Nhập tên"),
  lastName: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  email: z.string().email("Email không hợp lệ").optional().or(z.literal("")),
  birthDate: z.string().trim().optional(),
});

export async function updateCustomer(
  input: z.infer<typeof updateSchema>,
): Promise<FormResult> {
  const ctx = await requireBusinessContext();
  if (!hasAtLeast(ctx.role, "BUSINESS_MANAGER")) {
    return { ok: false, error: "Bạn không có quyền sửa khách hàng." };
  }
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message };
  const d = parsed.data;

  const existing = await db.customerProfile.findFirst({
    where: { id: d.customerId, businessId: ctx.businessId },
    select: { id: true },
  });
  if (!existing) return { ok: false, error: "Không tìm thấy khách hàng." };

  const conflict = await findCustomerConflict(ctx.businessId, {
    phone: d.phone,
    email: d.email,
    excludeId: d.customerId,
  });
  if (conflict === "phone") return { ok: false, error: "Số điện thoại này đã được đăng ký." };
  if (conflict === "email") return { ok: false, error: "Email này đã được đăng ký." };

  const bd = d.birthDate ? new Date(d.birthDate) : null;
  await db.customerProfile.update({
    where: { id: d.customerId },
    data: {
      firstName: d.firstName,
      lastName: d.lastName || null,
      phone: d.phone || null,
      email: d.email || null,
      birthDate: bd && !Number.isNaN(bd.getTime()) ? bd : null,
    },
  });
  revalidatePath(`/dashboard/customers/${d.customerId}`);
  return { ok: true };
}

// ── Delete customer (requires password confirmation) ──────────────────────────

export async function deleteCustomer(
  customerId: string,
  password: string,
): Promise<FormResult> {
  const ctx = await requireBusinessContext();
  if (!hasAtLeast(ctx.role, "BUSINESS_OWNER")) {
    return { ok: false, error: "Chỉ chủ doanh nghiệp mới được xóa khách hàng." };
  }
  if (!password) return { ok: false, error: "Nhập mật khẩu để xác nhận." };

  // Confirm the acting owner's password before a destructive delete.
  const user = await db.user.findUnique({
    where: { id: ctx.user.id },
    select: { passwordHash: true },
  });
  if (!user?.passwordHash) return { ok: false, error: "Tài khoản chưa đặt mật khẩu." };
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return { ok: false, error: "Mật khẩu không đúng." };

  const customer = await db.customerProfile.findFirst({
    where: { id: customerId, businessId: ctx.businessId },
    select: { id: true, userId: true },
  });
  if (!customer) return { ok: false, error: "Không tìm thấy khách hàng." };

  await db.$transaction(async (tx) => {
    // Cascades transactions, vouchers, redemptions, membership, etc.
    await tx.customerProfile.delete({ where: { id: customer.id } });
    // Remove an orphan self-service CUSTOMER account with no other memberships.
    if (customer.userId) {
      const others = await tx.customerProfile.count({ where: { userId: customer.userId } });
      if (others === 0) {
        const u = await tx.user.findUnique({
          where: { id: customer.userId },
          select: { role: true },
        });
        if (u?.role === "CUSTOMER") await tx.user.delete({ where: { id: customer.userId } });
      }
    }
    await tx.auditLog.create({
      data: {
        businessId: ctx.businessId,
        userId: ctx.user.id,
        action: "customer.delete",
        entity: "CustomerProfile",
        entityId: customerId,
      },
    });
  });

  revalidatePath("/dashboard/customers");
  return { ok: true };
}
