import { db } from "@/lib/db";
import { calculateEarnedPoints, canRedeem, type PointsRule } from "@/lib/points";
import { notifyPointsEarned, notifyRewardRedeemed } from "@/lib/whatsapp/service";
import { sendPointsEarnedWhatsApp } from "@/lib/whatsapp/membership-card";
import type { BusinessContext } from "@/lib/tenant";
import type { Prisma, TransactionType } from "@prisma/client";

export type EngineResult =
  | { ok: true; transactionId: string; balanceAfter: number; points: number }
  | { ok: false; error: EngineError };

export type EngineError =
  | "customer_not_found"
  | "cross_tenant"
  | "duplicate_submit"
  | "receipt_reused"
  | "rate_limited"
  | "self_grant"
  | "insufficient_points"
  | "staff_cap_exceeded"
  | "invalid_amount"
  | "not_found"
  | "already_reversed";

const HOUR_MS = 60 * 60 * 1000;

interface EarnInput {
  ctx: BusinessContext;
  customerId: string;
  amount: number;
  receiptRef?: string | null;
  idempotencyKey?: string | null;
  note?: string | null;
  device?: string | null;
  ip?: string | null;
}

/** EARN points from an invoice amount. Fully guarded + idempotent. */
export async function earnPoints(input: EarnInput): Promise<EngineResult> {
  const { ctx, customerId, amount } = input;
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: "invalid_amount" };
  }

  const [customer, setting, staff, business] = await Promise.all([
    db.customerProfile.findUnique({
      where: { id: customerId },
      include: { membership: { include: { tier: true } } },
    }),
    db.businessSetting.findUnique({ where: { businessId: ctx.businessId } }),
    db.staffProfile.findUnique({ where: { id: ctx.staffProfileId } }),
    db.business.findUnique({ where: { id: ctx.businessId }, select: { name: true } }),
  ]);

  if (!customer || customer.businessId !== ctx.businessId) {
    return { ok: false, error: "customer_not_found" };
  }

  // Anti-fraud: a staff member cannot grant points to their own customer card.
  if (customer.userId && staff && customer.userId === staff.userId) {
    await raiseFraud(ctx.businessId, "HIGH", "self_grant", {
      staffId: ctx.staffProfileId,
      customerId,
    });
    return { ok: false, error: "self_grant" };
  }

  // Idempotency: same key returns the existing transaction result.
  if (input.idempotencyKey) {
    const existing = await db.transaction.findUnique({
      where: {
        businessId_idempotencyKey: {
          businessId: ctx.businessId,
          idempotencyKey: input.idempotencyKey,
        },
      },
    });
    if (existing) {
      return {
        ok: true,
        transactionId: existing.id,
        balanceAfter: existing.balanceAfter,
        points: existing.points,
      };
    }
  }

  // Anti-fraud: one receipt can only be used once (unique constraint too).
  if (input.receiptRef) {
    const reused = await db.transaction.findFirst({
      where: { businessId: ctx.businessId, receiptRef: input.receiptRef },
    });
    if (reused) {
      await raiseFraud(ctx.businessId, "MEDIUM", "reused_receipt", {
        receiptRef: input.receiptRef,
        customerId,
      });
      return { ok: false, error: "receipt_reused" };
    }
  }

  // Anti-fraud: per-customer hourly rate limit.
  const recentCount = await db.transaction.count({
    where: {
      businessId: ctx.businessId,
      customerId,
      createdAt: { gte: new Date(Date.now() - HOUR_MS) },
    },
  });
  const maxPerHour = setting?.maxTxnPerCustomerHour ?? 5;
  if (recentCount >= maxPerHour) {
    await raiseFraud(ctx.businessId, "MEDIUM", "rapid_txn", {
      customerId,
      count: recentCount,
    });
    return { ok: false, error: "rate_limited" };
  }

  const rule: PointsRule = {
    amountPerPoint: setting?.amountPerPoint ?? 1,
    pointsPerUnit: setting?.pointsPerUnit ?? 1,
    rounding: (setting?.rounding as PointsRule["rounding"]) ?? "floor",
    minPointsPerTxn: setting?.minPointsPerTxn ?? 0,
    maxPointsPerTxn: setting?.maxPointsPerTxn ?? undefined,
    tierMultiplier: customer.membership?.tier.pointsMultiplier ?? 1,
  };

  let points = calculateEarnedPoints(amount, rule);

  // Anti-fraud: per-staff grant cap.
  if (staff?.maxPointsGrant != null && points > staff.maxPointsGrant) {
    return { ok: false, error: "staff_cap_exceeded" };
  }

  const balanceBefore = customer.pointsBalance;
  const balanceAfter = balanceBefore + points;

  const txn = await db.$transaction(async (tx) => {
    const created = await tx.transaction.create({
      data: {
        businessId: ctx.businessId,
        branchId: ctx.branchId,
        customerId,
        staffId: ctx.staffProfileId,
        type: "EARN",
        status: "COMPLETED",
        amount,
        points,
        balanceBefore,
        balanceAfter,
        idempotencyKey: input.idempotencyKey ?? undefined,
        receiptRef: input.receiptRef ?? undefined,
        note: input.note ?? undefined,
        device: input.device ?? undefined,
        ipAddress: input.ip ?? undefined,
      },
    });

    await tx.customerProfile.update({
      where: { id: customerId },
      data: {
        pointsBalance: balanceAfter,
        totalEarned: { increment: points },
        visitCount: { increment: 1 },
        lastVisitAt: new Date(),
      },
    });

    await tx.auditLog.create({
      data: {
        businessId: ctx.businessId,
        userId: ctx.user.id,
        action: "transaction.earn",
        entity: "Transaction",
        entityId: created.id,
        metadata: { amount, points },
      },
    });

    return created;
  });

  // Large-transaction alert (non-blocking flag for review).
  const threshold = setting?.largeTxnThreshold ?? 500;
  if (points >= threshold) {
    await raiseFraud(ctx.businessId, "HIGH", "large_txn", {
      transactionId: txn.id,
      points,
    });
  }

  await recalcTier(ctx.businessId, customerId);
  await notifyCustomer(customer.userId, ctx.businessId, "POINTS_EARNED", {
    points,
    balanceAfter,
  });

  // Fire the WhatsApp notification. Wrapped so a delivery failure can NEVER
  // roll back or fail the already-committed points transaction.
  try {
    await notifyPointsEarned({
      businessId: ctx.businessId,
      customerId,
      transactionId: txn.id,
      points,
      balanceAfter,
      totalEarned: customer.totalEarned + points,
      storeName: business?.name ?? "PTC Loyalty",
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[whatsapp] earn notification failed:", err);
  }

  // Env-token fallback (single-business setup without a per-tenant connection).
  await sendPointsEarnedWhatsApp({
    businessId: ctx.businessId,
    customerId,
    points,
    balanceAfter,
    storeName: business?.name ?? "PTC Loyalty",
  });

  return { ok: true, transactionId: txn.id, balanceAfter, points };
}

interface RedeemInput {
  ctx: BusinessContext;
  customerId: string;
  cost: number;
  type?: Extract<TransactionType, "REDEEM" | "REFUND">;
  note?: string | null;
  rewardId?: string | null;
  idempotencyKey?: string | null;
}

/** REDEEM points (reward / voucher). Guards against overspend. */
export async function redeemPoints(input: RedeemInput): Promise<EngineResult> {
  const { ctx, customerId, cost } = input;

  const customer = await db.customerProfile.findUnique({
    where: { id: customerId },
  });
  if (!customer || customer.businessId !== ctx.businessId) {
    return { ok: false, error: "customer_not_found" };
  }

  const check = canRedeem(customer.pointsBalance, cost);
  if (!check.ok) {
    return {
      ok: false,
      error: check.reason === "insufficient_points" ? "insufficient_points" : "invalid_amount",
    };
  }

  const balanceBefore = customer.pointsBalance;
  const balanceAfter = balanceBefore - cost;

  const txn = await db.$transaction(async (tx) => {
    const created = await tx.transaction.create({
      data: {
        businessId: ctx.businessId,
        branchId: ctx.branchId,
        customerId,
        staffId: ctx.staffProfileId,
        type: input.type ?? "REDEEM",
        status: "COMPLETED",
        points: -cost,
        balanceBefore,
        balanceAfter,
        note: input.note ?? undefined,
        idempotencyKey: input.idempotencyKey ?? undefined,
      },
    });

    await tx.customerProfile.update({
      where: { id: customerId },
      data: {
        pointsBalance: balanceAfter,
        totalRedeemed: { increment: cost },
      },
    });

    await tx.auditLog.create({
      data: {
        businessId: ctx.businessId,
        userId: ctx.user.id,
        action: "transaction.redeem",
        entity: "Transaction",
        entityId: created.id,
        metadata: { cost, rewardId: input.rewardId },
      },
    });

    return created;
  });

  await notifyCustomer(customer.userId, ctx.businessId, "REWARD_REDEEMED", {
    cost,
    balanceAfter,
  });

  try {
    const business = await db.business.findUnique({
      where: { id: ctx.businessId },
      select: { name: true },
    });
    await notifyRewardRedeemed({
      businessId: ctx.businessId,
      customerId,
      transactionId: txn.id,
      pointsSpent: cost,
      balanceAfter,
      storeName: business?.name ?? "PTC Loyalty",
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[whatsapp] redeem notification failed:", err);
  }

  return { ok: true, transactionId: txn.id, balanceAfter, points: -cost };
}

interface AdjustInput {
  ctx: BusinessContext;
  customerId: string;
  pointsDelta: number; // signed
  reason: string;
}

/** Manager/owner adjustment with mandatory reason + audit. */
export async function adjustPoints(input: AdjustInput): Promise<EngineResult> {
  const { ctx, customerId, pointsDelta, reason } = input;
  if (!reason.trim()) return { ok: false, error: "invalid_amount" };

  const customer = await db.customerProfile.findUnique({
    where: { id: customerId },
  });
  if (!customer || customer.businessId !== ctx.businessId) {
    return { ok: false, error: "customer_not_found" };
  }

  const balanceBefore = customer.pointsBalance;
  const balanceAfter = Math.max(0, balanceBefore + pointsDelta);
  const applied = balanceAfter - balanceBefore;

  const txn = await db.$transaction(async (tx) => {
    const created = await tx.transaction.create({
      data: {
        businessId: ctx.businessId,
        branchId: ctx.branchId,
        customerId,
        staffId: ctx.staffProfileId,
        type: "ADJUSTMENT",
        status: "COMPLETED",
        points: applied,
        balanceBefore,
        balanceAfter,
        note: reason,
      },
    });

    await tx.transactionAdjustment.create({
      data: {
        businessId: ctx.businessId,
        transactionId: created.id,
        reason,
        pointsDelta: applied,
        performedById: ctx.user.id,
      },
    });

    await tx.customerProfile.update({
      where: { id: customerId },
      data: { pointsBalance: balanceAfter },
    });

    await tx.auditLog.create({
      data: {
        businessId: ctx.businessId,
        userId: ctx.user.id,
        action: "transaction.adjust",
        entity: "Transaction",
        entityId: created.id,
        metadata: { pointsDelta: applied, reason },
      },
    });

    return created;
  });

  await recalcTier(ctx.businessId, customerId);
  return { ok: true, transactionId: txn.id, balanceAfter, points: applied };
}

/** Reverse a COMPLETED transaction, restoring the balance delta. */
export async function reverseTransaction(
  ctx: BusinessContext,
  transactionId: string,
  reason: string,
): Promise<EngineResult> {
  const original = await db.transaction.findUnique({
    where: { id: transactionId },
  });
  if (!original || original.businessId !== ctx.businessId) {
    return { ok: false, error: "not_found" };
  }
  if (original.status === "REVERSED") {
    return { ok: false, error: "already_reversed" };
  }

  const customer = await db.customerProfile.findUnique({
    where: { id: original.customerId },
  });
  if (!customer) return { ok: false, error: "customer_not_found" };

  const balanceBefore = customer.pointsBalance;
  const balanceAfter = Math.max(0, balanceBefore - original.points);

  const txn = await db.$transaction(async (tx) => {
    await tx.transaction.update({
      where: { id: transactionId },
      data: { status: "REVERSED" },
    });

    const reversal = await tx.transaction.create({
      data: {
        businessId: ctx.businessId,
        branchId: original.branchId,
        customerId: original.customerId,
        staffId: ctx.staffProfileId,
        type: "REFUND",
        status: "COMPLETED",
        points: -original.points,
        balanceBefore,
        balanceAfter,
        note: `Reversal of ${transactionId}: ${reason}`,
      },
    });

    await tx.customerProfile.update({
      where: { id: original.customerId },
      data: { pointsBalance: balanceAfter },
    });

    await tx.auditLog.create({
      data: {
        businessId: ctx.businessId,
        userId: ctx.user.id,
        action: "transaction.reverse",
        entity: "Transaction",
        entityId: transactionId,
        metadata: { reason },
      },
    });

    return reversal;
  });

  await recalcTier(ctx.businessId, original.customerId);
  return { ok: true, transactionId: txn.id, balanceAfter, points: -original.points };
}

// ── helpers ──────────────────────────────────────────────────────────────────

async function raiseFraud(
  businessId: string,
  level: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  kind: string,
  metadata: Prisma.InputJsonValue,
) {
  await db.fraudAlert.create({
    data: {
      businessId,
      level,
      kind,
      description: `Auto-detected: ${kind}`,
      metadata,
    },
  });
}

/** Recompute a customer's tier based on lifetime earned points. */
export async function recalcTier(businessId: string, customerId: string) {
  const customer = await db.customerProfile.findUnique({
    where: { id: customerId },
    include: { membership: true },
  });
  if (!customer) return;

  const tier = await db.membershipTier.findFirst({
    where: { businessId, minPoints: { lte: customer.totalEarned } },
    orderBy: { level: "desc" },
  });
  if (!tier) return;

  if (!customer.membership) {
    await db.customerMembership.create({
      data: { businessId, customerId, tierId: tier.id },
    });
  } else if (customer.membership.tierId !== tier.id) {
    await db.customerMembership.update({
      where: { customerId },
      data: { tierId: tier.id, since: new Date() },
    });
    await notifyCustomer(customer.userId, businessId, "TIER_UPGRADE_SOON", {
      tier: tier.name,
    });
  }
}

async function notifyCustomer(
  userId: string | null,
  businessId: string,
  type: Parameters<typeof db.notification.create>[0]["data"]["type"],
  data: Prisma.InputJsonValue,
) {
  if (!userId) return;
  const titles: Record<string, string> = {
    POINTS_EARNED: "Bạn vừa được cộng điểm",
    REWARD_REDEEMED: "Đổi thưởng thành công",
    TIER_UPGRADE_SOON: "Chúc mừng! Bạn đã lên hạng",
  };
  await db.notification.create({
    data: {
      userId,
      businessId,
      type,
      title: titles[type] ?? "Thông báo",
      data,
    },
  });
}
