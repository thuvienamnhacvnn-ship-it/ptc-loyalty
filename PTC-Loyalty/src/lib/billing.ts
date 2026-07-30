import { db } from "@/lib/db";
import type { PaymentMethod, PaymentStatus, SubscriptionStatus } from "@prisma/client";

// ── Display labels (Vietnamese admin console) ────────────────────────────────

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  BANK_TRANSFER: "Chuyển khoản",
  SEPA_DIRECT_DEBIT: "SEPA Lastschrift",
  CARD: "Thẻ",
  PAYPAL: "PayPal",
  CASH: "Tiền mặt",
  OTHER: "Khác",
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  PENDING: "Chờ thanh toán",
  PAID: "Đã thu",
  FAILED: "Thất bại",
  REFUNDED: "Đã hoàn",
};

export const SUBSCRIPTION_STATUS_LABELS: Record<SubscriptionStatus, string> = {
  TRIALING: "Dùng thử",
  ACTIVE: "Đang hoạt động",
  PAST_DUE: "Quá hạn",
  CANCELLED: "Đã hủy",
  SUSPENDED: "Tạm ngưng",
};

export const PAYMENT_STATUS_VARIANT: Record<
  PaymentStatus,
  "success" | "warning" | "destructive" | "secondary"
> = {
  PAID: "success",
  PENDING: "warning",
  FAILED: "destructive",
  REFUNDED: "secondary",
};

/** Only PAID rows count as money actually collected. */
export function isCollected(status: PaymentStatus): boolean {
  return status === "PAID";
}

/**
 * Advance a billing period by whole months, clamping the day-of-month so
 * 31 Jan + 1 month lands on 28/29 Feb rather than spilling into March.
 */
export function addMonths(from: Date, months: number): Date {
  const d = new Date(from);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  const daysInTargetMonth = new Date(
    d.getFullYear(),
    d.getMonth() + 1,
    0,
  ).getDate();
  d.setDate(Math.min(day, daysInTargetMonth));
  return d;
}

/**
 * Where the next paid period should start: from the end of the current one if
 * the subscription is still running, otherwise from today (a lapsed tenant
 * should not be credited for the gap).
 */
export function nextPeriodStart(currentPeriodEnd: Date | null | undefined): Date {
  const now = new Date();
  if (currentPeriodEnd && currentPeriodEnd > now) return new Date(currentPeriodEnd);
  return now;
}

export interface RevenueSummary {
  /** All-time collected, in cents. */
  collectedTotal: number;
  /** Collected in the current calendar month, in cents. */
  collectedThisMonth: number;
  /** Recorded but not yet collected (PENDING), in cents. */
  outstanding: number;
  /** Monthly recurring revenue from ACTIVE subscriptions, in cents. */
  mrr: number;
  paymentCount: number;
}

/** Platform-wide revenue figures for the admin console. */
export async function getRevenueSummary(): Promise<RevenueSummary> {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [collected, thisMonth, pending, activeSubs] = await Promise.all([
    db.payment.aggregate({
      where: { status: "PAID" },
      _sum: { amount: true },
      _count: true,
    }),
    db.payment.aggregate({
      where: { status: "PAID", paidAt: { gte: monthStart } },
      _sum: { amount: true },
    }),
    db.payment.aggregate({
      where: { status: "PENDING" },
      _sum: { amount: true },
    }),
    db.subscription.findMany({
      where: { status: "ACTIVE" },
      select: { plan: { select: { priceMonthly: true } } },
    }),
  ]);

  return {
    collectedTotal: collected._sum.amount ?? 0,
    collectedThisMonth: thisMonth._sum.amount ?? 0,
    outstanding: pending._sum.amount ?? 0,
    mrr: activeSubs.reduce((sum, s) => sum + s.plan.priceMonthly, 0),
    paymentCount: collected._count,
  };
}
