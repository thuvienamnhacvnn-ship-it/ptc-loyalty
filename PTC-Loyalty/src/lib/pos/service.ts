import { db } from "@/lib/db";
import { calculateEarnedPoints, type PointsRule } from "@/lib/points";
import { verifyQrToken } from "@/lib/qr";
import { generateMemberCode } from "@/lib/utils";
import { findCustomerConflict } from "@/lib/customer-dedup";
import type { PosContext } from "@/lib/pos/context";
import type {
  PosCustomer,
  PosCustomerDetail,
  PosEarnPreview,
  PosReward,
  PosWhatsAppStatus,
} from "@/lib/pos/contract";

// POS read/service helpers. Business logic (points calc, fraud, DB writes) is NOT
// duplicated in the desktop client — it lives here and in src/lib/transactions.ts.

type CustomerWithTier = {
  id: string;
  firstName: string;
  lastName: string | null;
  memberCode: string;
  pointsBalance: number;
  phone: string | null;
  email: string | null;
  isBlocked: boolean;
  membership: { tier: { name: string } } | null;
};

const customerSelect = {
  id: true,
  firstName: true,
  lastName: true,
  memberCode: true,
  pointsBalance: true,
  phone: true,
  email: true,
  isBlocked: true,
  membership: { include: { tier: true } },
} as const;

function toPosCustomer(c: CustomerWithTier): PosCustomer {
  return {
    id: c.id,
    name: `${c.firstName} ${c.lastName ?? ""}`.trim(),
    memberCode: c.memberCode,
    pointsBalance: c.pointsBalance,
    tier: c.membership?.tier.name ?? null,
    phone: c.phone,
    email: c.email,
  };
}

export type CustomerResult =
  | { ok: true; customer: PosCustomer }
  | { ok: false; error: string };

/** Manual lookup by member code / phone / email / name (tenant-scoped). */
export async function searchCustomer(
  ctx: PosContext,
  query: string,
): Promise<CustomerResult> {
  const q = query.trim();
  if (q.length < 2) return { ok: false, error: "bad_request" };

  const customer = await db.customerProfile.findFirst({
    where: {
      businessId: ctx.businessId,
      OR: [
        { memberCode: { equals: q, mode: "insensitive" } },
        { phone: { contains: q } },
        { email: { contains: q, mode: "insensitive" } },
        { firstName: { contains: q, mode: "insensitive" } },
        { lastName: { contains: q, mode: "insensitive" } },
      ],
    },
    select: customerSelect,
    orderBy: { lastVisitAt: "desc" },
  });
  if (!customer) return { ok: false, error: "customer_not_found" };
  if (customer.isBlocked) return { ok: false, error: "customer_not_found" };
  return { ok: true, customer: toPosCustomer(customer) };
}

export type CreateCustomerResult =
  | { ok: true; customer: PosCustomer; customerId: string; memberCode: string; qrSecret: string }
  | { ok: false; error: string };

/**
 * Create a customer from the desktop client (tenant-scoped). memberCode + qrSecret
 * are generated automatically, so the caller can immediately render a fixed QR.
 */
export async function createPosCustomer(
  ctx: PosContext,
  input: {
    firstName: string;
    lastName?: string | null;
    phone?: string | null;
    email?: string | null;
    birthDate?: string | null;
  },
): Promise<CreateCustomerResult> {
  const firstName = input.firstName?.trim();
  if (!firstName) return { ok: false, error: "bad_request" };

  const conflict = await findCustomerConflict(ctx.businessId, {
    phone: input.phone,
    email: input.email,
  });
  if (conflict === "phone") return { ok: false, error: "phone_taken" };
  if (conflict === "email") return { ok: false, error: "email_taken" };

  const bd = input.birthDate ? new Date(input.birthDate) : null;
  const created = await db.customerProfile.create({
    data: {
      businessId: ctx.businessId,
      memberCode: generateMemberCode(),
      firstName,
      lastName: input.lastName?.trim() || null,
      phone: input.phone?.trim() || null,
      email: input.email?.trim() || null,
      birthDate: bd && !Number.isNaN(bd.getTime()) ? bd : null,
    },
    select: { ...customerSelect, qrSecret: true },
  });
  return {
    ok: true,
    customer: toPosCustomer(created),
    customerId: created.id,
    memberCode: created.memberCode,
    qrSecret: created.qrSecret,
  };
}

/** Look up a customer's qrSecret for rendering their fixed QR (tenant-scoped). */
export async function customerQrData(
  ctx: PosContext,
  customerId: string,
): Promise<{ businessId: string; customerId: string; memberCode: string; secret: string } | null> {
  const c = await db.customerProfile.findFirst({
    where: { id: customerId, businessId: ctx.businessId },
    select: { id: true, memberCode: true, qrSecret: true },
  });
  if (!c) return null;
  return { businessId: ctx.businessId, customerId: c.id, memberCode: c.memberCode, secret: c.qrSecret };
}

/** Verify a scanned QR token and resolve the customer (tenant-scoped). */
export async function resolveQr(
  ctx: PosContext,
  token: string,
): Promise<CustomerResult> {
  const verified = verifyQrToken(token);
  if (!verified.ok) {
    const map: Record<string, string> = {
      expired: "qr_expired",
      bad_signature: "qr_bad_signature",
      malformed: "qr_malformed",
    };
    return { ok: false, error: map[verified.reason] ?? "qr_malformed" };
  }
  const payload = verified.payload;
  if (payload.b !== ctx.businessId) {
    return { ok: false, error: "qr_other_business" };
  }
  const customer = await db.customerProfile.findUnique({
    where: { id: payload.c },
    select: { ...customerSelect, businessId: true, qrSecret: true },
  });
  if (!customer || customer.businessId !== ctx.businessId) {
    return { ok: false, error: "customer_not_found" };
  }
  if (customer.qrSecret !== payload.s) {
    return { ok: false, error: "qr_revoked" };
  }
  if (customer.isBlocked) return { ok: false, error: "customer_not_found" };
  return { ok: true, customer: toPosCustomer(customer) };
}

/** Full customer detail: balance, lifetime stats, recent txns & vouchers. */
export async function customerDetail(
  ctx: PosContext,
  customerId: string,
): Promise<PosCustomerDetail | null> {
  const customer = await db.customerProfile.findFirst({
    where: { id: customerId, businessId: ctx.businessId },
    select: {
      ...customerSelect,
      totalEarned: true,
      totalRedeemed: true,
      visitCount: true,
    },
  });
  if (!customer) return null;

  const [txns, vouchers] = await Promise.all([
    db.transaction.findMany({
      where: { businessId: ctx.businessId, customerId },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        type: true,
        points: true,
        amount: true,
        balanceAfter: true,
        note: true,
        createdAt: true,
      },
    }),
    db.customerVoucher.findMany({
      where: { businessId: ctx.businessId, customerId, status: "ISSUED" },
      orderBy: { issuedAt: "desc" },
      take: 10,
      include: { voucher: { select: { title: true } } },
    }),
  ]);

  return {
    ...toPosCustomer(customer),
    totalEarned: customer.totalEarned,
    totalRedeemed: customer.totalRedeemed,
    visitCount: customer.visitCount,
    recentTransactions: txns.map((t) => ({
      id: t.id,
      type: t.type,
      points: t.points,
      amount: t.amount,
      balanceAfter: t.balanceAfter,
      note: t.note,
      createdAt: t.createdAt.toISOString(),
    })),
    vouchers: vouchers.map((v) => ({
      id: v.id,
      code: v.code,
      title: v.voucher.title,
      status: v.status,
      expiresAt: v.expiresAt ? v.expiresAt.toISOString() : null,
    })),
  };
}

/** Compute expected points for an amount WITHOUT writing anything. */
export async function previewEarn(
  ctx: PosContext,
  customerId: string,
  amount: number,
): Promise<PosEarnPreview | { error: string }> {
  if (!Number.isFinite(amount) || amount <= 0) return { error: "invalid_amount" };
  const [customer, setting] = await Promise.all([
    db.customerProfile.findFirst({
      where: { id: customerId, businessId: ctx.businessId },
      include: { membership: { include: { tier: true } } },
    }),
    db.businessSetting.findUnique({ where: { businessId: ctx.businessId } }),
  ]);
  if (!customer) return { error: "customer_not_found" };

  const rule: PointsRule = {
    amountPerPoint: setting?.amountPerPoint ?? 1,
    pointsPerUnit: setting?.pointsPerUnit ?? 1,
    rounding: (setting?.rounding as PointsRule["rounding"]) ?? "floor",
    minPointsPerTxn: setting?.minPointsPerTxn ?? 0,
    maxPointsPerTxn: setting?.maxPointsPerTxn ?? undefined,
    tierMultiplier: customer.membership?.tier.pointsMultiplier ?? 1,
  };
  const points = calculateEarnedPoints(amount, rule);
  return {
    amount,
    points,
    balanceBefore: customer.pointsBalance,
    balanceAfter: customer.pointsBalance + points,
  };
}

export type VoucherRedeemResult =
  | { ok: true; voucherId: string; code: string; title: string }
  | { ok: false; error: string };

/** Confirm/consume a customer's issued voucher at the counter. */
export async function redeemVoucher(
  ctx: PosContext,
  code: string,
): Promise<VoucherRedeemResult> {
  const cv = await db.customerVoucher.findFirst({
    where: { businessId: ctx.businessId, code: code.trim().toUpperCase() },
    include: { voucher: { select: { title: true } } },
  });
  if (!cv) return { ok: false, error: "voucher_not_found" };
  if (cv.status === "REDEEMED") return { ok: false, error: "voucher_used" };
  if (cv.status !== "ISSUED") return { ok: false, error: "voucher_not_found" };
  if (cv.expiresAt && cv.expiresAt.getTime() < Date.now()) {
    return { ok: false, error: "voucher_expired" };
  }

  await db.$transaction(async (tx) => {
    await tx.customerVoucher.update({
      where: { id: cv.id },
      data: { status: "REDEEMED", redeemedAt: new Date() },
    });
    await tx.auditLog.create({
      data: {
        businessId: ctx.businessId,
        userId: ctx.user.id,
        action: "voucher.redeem",
        entity: "CustomerVoucher",
        entityId: cv.id,
        metadata: { code: cv.code },
      },
    });
  });
  return { ok: true, voucherId: cv.id, code: cv.code, title: cv.voucher.title };
}

/** Active rewards catalog for the business. */
export async function listRewards(ctx: PosContext): Promise<PosReward[]> {
  const rewards = await db.reward.findMany({
    where: { businessId: ctx.businessId, status: "ACTIVE" },
    orderBy: { pointsCost: "asc" },
    select: { id: true, name: true, description: true, pointsCost: true, stock: true },
  });
  return rewards;
}

/** Latest WhatsApp notification status for a transaction (for the POS UI). */
export async function whatsAppStatusForTxn(
  ctx: PosContext,
  transactionId: string,
): Promise<PosWhatsAppStatus> {
  const log = await db.whatsAppMessageLog.findFirst({
    where: { businessId: ctx.businessId, transactionId },
    orderBy: { createdAt: "desc" },
    select: { status: true },
  });
  if (!log) return "NONE";
  return log.status as PosWhatsAppStatus;
}
