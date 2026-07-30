"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/tenant";
import { addMonths, nextPeriodStart } from "@/lib/billing";
import type {
  BusinessStatus,
  PaymentMethod,
  PaymentStatus,
  PlanTier,
  SubscriptionStatus,
  UserRole,
} from "@prisma/client";

export interface Result {
  ok: boolean;
  error?: string;
}

/**
 * Every mutation in this file is a platform-admin action taken *on behalf of*
 * a tenant, so each one writes an AuditLog row attributing the change to the
 * admin who made it. `businessId` is nullable on AuditLog, which lets us log
 * user-level changes that are not scoped to any one tenant.
 */
async function logAdminAction(input: {
  adminId: string;
  action: string;
  entity: string;
  entityId: string;
  businessId?: string | null;
  metadata?: Prisma.InputJsonValue;
}) {
  await db.auditLog.create({
    data: {
      businessId: input.businessId ?? null,
      userId: input.adminId,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId,
      metadata: input.metadata,
    },
  });
}

function firstError(error: z.ZodError): string {
  return error.errors[0]?.message ?? "Dữ liệu không hợp lệ";
}

// ── Businesses ───────────────────────────────────────────────────────────────

export async function setBusinessStatus(
  businessId: string,
  status: BusinessStatus,
): Promise<Result> {
  const admin = await requirePlatformAdmin();
  await db.business.update({ where: { id: businessId }, data: { status } });
  await logAdminAction({
    adminId: admin.id,
    businessId,
    action: `admin.business.${status.toLowerCase()}`,
    entity: "Business",
    entityId: businessId,
  });
  revalidatePath(`/admin/businesses/${businessId}`);
  revalidatePath("/admin/businesses");
  return { ok: true };
}

const businessInfoSchema = z.object({
  name: z.string().trim().min(2, "Tên doanh nghiệp quá ngắn").max(120),
  type: z.string().trim().min(1, "Chọn loại hình"),
  email: z.string().trim().email("Email doanh nghiệp không hợp lệ"),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  addressLine: z.string().trim().max(200).optional().or(z.literal("")),
  city: z.string().trim().max(80).optional().or(z.literal("")),
  locale: z.enum(["vi", "de", "en"]),
});

export type BusinessInfoInput = z.infer<typeof businessInfoSchema>;

/** Edit a tenant's profile details from the platform console. */
export async function updateBusinessInfo(
  businessId: string,
  input: BusinessInfoInput,
): Promise<Result> {
  const admin = await requirePlatformAdmin();
  const parsed = businessInfoSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const d = parsed.data;

  await db.business.update({
    where: { id: businessId },
    data: {
      name: d.name,
      type: d.type,
      email: d.email.toLowerCase(),
      // Empty strings clear the optional column rather than storing "".
      phone: d.phone || null,
      addressLine: d.addressLine || null,
      city: d.city || null,
      locale: d.locale,
    },
  });

  await logAdminAction({
    adminId: admin.id,
    businessId,
    action: "admin.business.update",
    entity: "Business",
    entityId: businessId,
    metadata: { name: d.name, type: d.type, email: d.email },
  });
  revalidatePath(`/admin/businesses/${businessId}`);
  revalidatePath("/admin/businesses");
  return { ok: true };
}

// ── Subscriptions ────────────────────────────────────────────────────────────

const subscriptionSchema = z.object({
  planTier: z.enum(["BASIC", "BUSINESS", "PREMIUM"]),
  status: z.enum(["TRIALING", "ACTIVE", "PAST_DUE", "CANCELLED", "SUSPENDED"]),
  trialEndsAt: z.string().optional(),
  currentPeriodEnd: z.string().optional(),
});

export type SubscriptionInput = z.infer<typeof subscriptionSchema>;

/** Parse a `<input type="date">` value; empty string clears the column. */
function parseDate(value: string | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function updateSubscription(
  businessId: string,
  input: SubscriptionInput,
): Promise<Result> {
  const admin = await requirePlatformAdmin();
  const parsed = subscriptionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const d = parsed.data;

  const plan = await db.plan.findUnique({
    where: { tier: d.planTier as PlanTier },
    select: { id: true, name: true },
  });
  if (!plan) return { ok: false, error: "Gói dịch vụ chưa được khởi tạo" };

  const data = {
    planId: plan.id,
    status: d.status as SubscriptionStatus,
    trialEndsAt: parseDate(d.trialEndsAt),
    currentPeriodEnd: parseDate(d.currentPeriodEnd),
  };

  // A business created before subscriptions existed may have none yet.
  await db.subscription.upsert({
    where: { businessId },
    update: data,
    create: { businessId, ...data },
  });

  await logAdminAction({
    adminId: admin.id,
    businessId,
    action: "admin.subscription.update",
    entity: "Subscription",
    entityId: businessId,
    metadata: { plan: plan.name, status: d.status },
  });
  revalidatePath(`/admin/businesses/${businessId}`);
  revalidatePath("/admin/subscriptions");
  revalidatePath("/admin");
  return { ok: true };
}

// ── Payments ─────────────────────────────────────────────────────────────────

const paymentSchema = z.object({
  businessId: z.string().min(1),
  /** Entered in EUR by the admin; stored in cents. */
  amountEur: z.number().positive("Số tiền phải lớn hơn 0").max(100000),
  method: z.enum([
    "BANK_TRANSFER",
    "SEPA_DIRECT_DEBIT",
    "CARD",
    "PAYPAL",
    "CASH",
    "OTHER",
  ]),
  status: z.enum(["PENDING", "PAID", "FAILED", "REFUNDED"]),
  months: z.number().int().min(1).max(36).default(1),
  periodStart: z.string().optional(),
  reference: z.string().trim().max(120).optional().or(z.literal("")),
  note: z.string().trim().max(500).optional().or(z.literal("")),
  /** Extend the subscription period and re-activate it on a PAID payment. */
  extendSubscription: z.boolean().default(true),
});

export type PaymentInput = z.infer<typeof paymentSchema>;

/**
 * Record a subscription payment against a tenant.
 *
 * When the payment is PAID and `extendSubscription` is set, the subscription's
 * `currentPeriodEnd` is pushed out by `months` and a trialing/past-due/suspended
 * subscription flips to ACTIVE — which is what actually unblocks the tenant.
 */
export async function recordPayment(input: PaymentInput): Promise<Result> {
  const admin = await requirePlatformAdmin();
  const parsed = paymentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const d = parsed.data;

  const business = await db.business.findUnique({
    where: { id: d.businessId },
    select: {
      id: true,
      subscription: { select: { id: true, planId: true, currentPeriodEnd: true } },
    },
  });
  if (!business) return { ok: false, error: "Không tìm thấy doanh nghiệp" };

  const sub = business.subscription;
  const start = parseDate(d.periodStart) ?? nextPeriodStart(sub?.currentPeriodEnd);
  const end = addMonths(start, d.months);
  const collected = d.status === "PAID";

  await db.$transaction(async (tx) => {
    await tx.payment.create({
      data: {
        businessId: d.businessId,
        subscriptionId: sub?.id ?? null,
        planId: sub?.planId ?? null,
        amount: Math.round(d.amountEur * 100),
        method: d.method as PaymentMethod,
        status: d.status as PaymentStatus,
        periodStart: start,
        periodEnd: end,
        reference: d.reference || null,
        note: d.note || null,
        paidAt: collected ? new Date() : null,
        recordedById: admin.id,
      },
    });

    if (collected && d.extendSubscription && sub) {
      await tx.subscription.update({
        where: { id: sub.id },
        data: { status: "ACTIVE", currentPeriodEnd: end },
      });
    }
  });

  await logAdminAction({
    adminId: admin.id,
    businessId: d.businessId,
    action: "admin.payment.record",
    entity: "Payment",
    entityId: d.businessId,
    metadata: { amountEur: d.amountEur, method: d.method, status: d.status },
  });
  revalidatePath(`/admin/businesses/${d.businessId}`);
  revalidatePath("/admin/payments");
  revalidatePath("/admin");
  return { ok: true };
}

/**
 * Mark a recorded payment as collected / failed / refunded.
 *
 * A PENDING row that later becomes PAID must extend the subscription the same
 * way `recordPayment` would have — otherwise money arrives and the tenant stays
 * locked out. We only ever push `currentPeriodEnd` forward, never back.
 */
export async function setPaymentStatus(
  paymentId: string,
  status: PaymentStatus,
): Promise<Result> {
  const admin = await requirePlatformAdmin();
  const payment = await db.payment.findUnique({
    where: { id: paymentId },
    select: {
      id: true,
      businessId: true,
      paidAt: true,
      status: true,
      periodEnd: true,
      subscription: { select: { id: true, currentPeriodEnd: true } },
    },
  });
  if (!payment) return { ok: false, error: "Không tìm thấy khoản thanh toán" };

  const becomingPaid = status === "PAID" && payment.status !== "PAID";

  await db.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id: paymentId },
      data: {
        status,
        // Stamp paidAt the first time it becomes PAID; clear it if it un-pays.
        paidAt: status === "PAID" ? (payment.paidAt ?? new Date()) : null,
      },
    });

    const sub = payment.subscription;
    if (becomingPaid && sub && payment.periodEnd) {
      const extendsPeriod =
        !sub.currentPeriodEnd || payment.periodEnd > sub.currentPeriodEnd;
      await tx.subscription.update({
        where: { id: sub.id },
        data: {
          status: "ACTIVE",
          ...(extendsPeriod ? { currentPeriodEnd: payment.periodEnd } : {}),
        },
      });
    }
  });

  await logAdminAction({
    adminId: admin.id,
    businessId: payment.businessId,
    action: `admin.payment.${status.toLowerCase()}`,
    entity: "Payment",
    entityId: paymentId,
  });
  revalidatePath(`/admin/businesses/${payment.businessId}`);
  revalidatePath("/admin/payments");
  revalidatePath("/admin");
  return { ok: true };
}

/** Remove a payment recorded by mistake. Subscription dates are left as-is. */
export async function deletePayment(paymentId: string): Promise<Result> {
  const admin = await requirePlatformAdmin();
  const payment = await db.payment.findUnique({
    where: { id: paymentId },
    select: { businessId: true, amount: true },
  });
  if (!payment) return { ok: false, error: "Không tìm thấy khoản thanh toán" };

  await db.payment.delete({ where: { id: paymentId } });
  await logAdminAction({
    adminId: admin.id,
    businessId: payment.businessId,
    action: "admin.payment.delete",
    entity: "Payment",
    entityId: paymentId,
    metadata: { amount: payment.amount },
  });
  revalidatePath(`/admin/businesses/${payment.businessId}`);
  revalidatePath("/admin/payments");
  revalidatePath("/admin");
  return { ok: true };
}

// ── Users (business owners & everyone else) ──────────────────────────────────

const userInfoSchema = z.object({
  name: z.string().trim().min(2, "Tên quá ngắn").max(120),
  email: z.string().trim().email("Email không hợp lệ"),
  locale: z.enum(["vi", "de", "en"]),
});

export type UserInfoInput = z.infer<typeof userInfoSchema>;

export async function updateUserInfo(
  userId: string,
  input: UserInfoInput,
): Promise<Result> {
  const admin = await requirePlatformAdmin();
  const parsed = userInfoSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const d = parsed.data;

  try {
    await db.user.update({
      where: { id: userId },
      data: { name: d.name, email: d.email.toLowerCase(), locale: d.locale },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { ok: false, error: "Email này đã được dùng cho tài khoản khác" };
    }
    throw error;
  }

  await logAdminAction({
    adminId: admin.id,
    action: "admin.user.update",
    entity: "User",
    entityId: userId,
    metadata: { email: d.email },
  });
  revalidatePath("/admin/users");
  return { ok: true };
}

/**
 * Refuse a change that would leave the platform with no way in. Counts active
 * SUPER_ADMINs excluding `excludeUserId` (the one about to be locked or demoted).
 */
async function wouldRemoveLastAdmin(excludeUserId: string): Promise<boolean> {
  const remaining = await db.user.count({
    where: { role: "SUPER_ADMIN", isActive: true, id: { not: excludeUserId } },
  });
  return remaining === 0;
}

export async function setUserActive(
  userId: string,
  isActive: boolean,
): Promise<Result> {
  const admin = await requirePlatformAdmin();
  // Guard against an admin locking themselves out of the console.
  if (userId === admin.id && !isActive) {
    return { ok: false, error: "Không thể khóa chính tài khoản đang đăng nhập" };
  }

  if (!isActive) {
    const target = await db.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    if (target?.role === "SUPER_ADMIN" && (await wouldRemoveLastAdmin(userId))) {
      return {
        ok: false,
        error: "Đây là super admin hoạt động cuối cùng — khóa sẽ mất quyền vào console",
      };
    }
  }

  await db.user.update({ where: { id: userId }, data: { isActive } });
  await logAdminAction({
    adminId: admin.id,
    action: isActive ? "admin.user.activate" : "admin.user.deactivate",
    entity: "User",
    entityId: userId,
  });
  revalidatePath("/admin/users");
  return { ok: true };
}

export async function setUserRole(
  userId: string,
  role: UserRole,
): Promise<Result> {
  const admin = await requirePlatformAdmin();
  if (userId === admin.id && role !== "SUPER_ADMIN") {
    return { ok: false, error: "Không thể tự hạ quyền tài khoản đang đăng nhập" };
  }

  if (role !== "SUPER_ADMIN") {
    const target = await db.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    if (target?.role === "SUPER_ADMIN" && (await wouldRemoveLastAdmin(userId))) {
      return {
        ok: false,
        error: "Đây là super admin hoạt động cuối cùng — hạ quyền sẽ mất quyền vào console",
      };
    }
  }

  await db.user.update({ where: { id: userId }, data: { role } });
  await logAdminAction({
    adminId: admin.id,
    action: "admin.user.role",
    entity: "User",
    entityId: userId,
    metadata: { role },
  });
  revalidatePath("/admin/users");
  return { ok: true };
}

export interface ResetPasswordResult extends Result {
  /** Shown to the admin once; never stored in plaintext. */
  password?: string;
}

/**
 * Issue a temporary password for an owner who cannot get into their account.
 * The generated value is returned to the admin exactly once (to read out over
 * the phone) — only the bcrypt hash is persisted. Any outstanding self-service
 * reset links are invalidated so the two flows cannot race.
 */
export async function resetUserPassword(
  userId: string,
): Promise<ResetPasswordResult> {
  const admin = await requirePlatformAdmin();
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });
  if (!user) return { ok: false, error: "Không tìm thấy tài khoản" };

  // 9 bytes of base64url ≈ 12 chars, unambiguous and easy to dictate.
  const password = crypto.randomBytes(9).toString("base64url");
  const passwordHash = await bcrypt.hash(password, 10);

  await db.$transaction([
    db.user.update({ where: { id: userId }, data: { passwordHash } }),
    db.verificationToken.deleteMany({ where: { identifier: user.email } }),
  ]);

  await logAdminAction({
    adminId: admin.id,
    action: "admin.user.password_reset",
    entity: "User",
    entityId: userId,
  });
  revalidatePath("/admin/users");
  return { ok: true, password };
}

// ── Fraud ────────────────────────────────────────────────────────────────────

export async function resolveFraudAlert(alertId: string): Promise<Result> {
  await requirePlatformAdmin();
  await db.fraudAlert.update({
    where: { id: alertId },
    data: { resolvedAt: new Date() },
  });
  revalidatePath("/admin/fraud");
  return { ok: true };
}
