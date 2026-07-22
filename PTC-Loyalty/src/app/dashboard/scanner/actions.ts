"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { requireBusinessContext } from "@/lib/tenant";
import { verifyQrToken } from "@/lib/qr";
import { earnPoints } from "@/lib/transactions";

export interface ResolvedCustomer {
  id: string;
  name: string;
  memberCode: string;
  pointsBalance: number;
  tier: string | null;
  phone: string | null;
}

export type ResolveResult =
  | { ok: true; customer: ResolvedCustomer }
  | { ok: false; error: string };

async function toResolved(customer: {
  id: string;
  firstName: string;
  lastName: string | null;
  memberCode: string;
  pointsBalance: number;
  phone: string | null;
  membership: { tier: { name: string } } | null;
  isBlocked: boolean;
}): Promise<ResolveResult> {
  if (customer.isBlocked) {
    return { ok: false, error: "Tài khoản khách hàng đang bị khóa." };
  }
  return {
    ok: true,
    customer: {
      id: customer.id,
      name: `${customer.firstName} ${customer.lastName ?? ""}`.trim(),
      memberCode: customer.memberCode,
      pointsBalance: customer.pointsBalance,
      tier: customer.membership?.tier.name ?? null,
      phone: customer.phone,
    },
  };
}

/** Verify a scanned QR token and resolve the customer (tenant-scoped). */
export async function resolveQrToken(token: string): Promise<ResolveResult> {
  const ctx = await requireBusinessContext();
  const verified = verifyQrToken(token);
  if (!verified.ok) {
    const map: Record<string, string> = {
      expired: "Mã QR đã hết hạn. Yêu cầu khách làm mới.",
      bad_signature: "Mã QR không hợp lệ.",
      malformed: "Mã QR không đọc được.",
    };
    return { ok: false, error: map[verified.reason] };
  }

  const payload = verified.payload;
  if (payload.b !== ctx.businessId) {
    return { ok: false, error: "Mã QR thuộc doanh nghiệp khác." };
  }

  const customer = await db.customerProfile.findUnique({
    where: { id: payload.c },
    include: { membership: { include: { tier: true } } },
  });
  if (!customer || customer.businessId !== ctx.businessId) {
    return { ok: false, error: "Không tìm thấy khách hàng." };
  }
  // Secret must match — lets a business invalidate old QRs by rotating it.
  if (customer.qrSecret !== payload.s) {
    return { ok: false, error: "Mã QR đã bị thu hồi." };
  }
  return toResolved(customer);
}

const searchSchema = z.string().trim().min(2);

/** Manual lookup by member code / phone / email / name. */
export async function findCustomer(query: string): Promise<ResolveResult> {
  const ctx = await requireBusinessContext();
  const parsed = searchSchema.safeParse(query);
  if (!parsed.success) return { ok: false, error: "Nhập ít nhất 2 ký tự." };
  const q = parsed.data;

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
    include: { membership: { include: { tier: true } } },
    orderBy: { lastVisitAt: "desc" },
  });
  if (!customer) return { ok: false, error: "Không tìm thấy khách hàng." };
  return toResolved(customer);
}

const earnSchema = z.object({
  customerId: z.string().min(1),
  amount: z.coerce.number().positive("Số tiền phải lớn hơn 0"),
  receiptRef: z.string().trim().optional(),
  idempotencyKey: z.string().min(8),
});

export interface EarnActionResult {
  ok: boolean;
  error?: string;
  points?: number;
  balanceAfter?: number;
}

const ERROR_MESSAGES: Record<string, string> = {
  customer_not_found: "Không tìm thấy khách hàng.",
  duplicate_submit: "Giao dịch đã được xử lý.",
  receipt_reused: "Hóa đơn này đã được sử dụng.",
  rate_limited: "Quá nhiều giao dịch trong thời gian ngắn. Thử lại sau.",
  self_grant: "Không thể tự cộng điểm cho chính mình.",
  staff_cap_exceeded: "Vượt giới hạn điểm nhân viên được phép cấp.",
  invalid_amount: "Số tiền không hợp lệ.",
};

export async function earnAction(
  input: z.infer<typeof earnSchema>,
): Promise<EarnActionResult> {
  const ctx = await requireBusinessContext();
  const parsed = earnSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." };
  }

  const result = await earnPoints({
    ctx,
    customerId: parsed.data.customerId,
    amount: parsed.data.amount,
    receiptRef: parsed.data.receiptRef || null,
    idempotencyKey: parsed.data.idempotencyKey,
    device: "scanner",
  });

  if (!result.ok) {
    return { ok: false, error: ERROR_MESSAGES[result.error] ?? "Giao dịch thất bại." };
  }
  return { ok: true, points: result.points, balanceAfter: result.balanceAfter };
}
