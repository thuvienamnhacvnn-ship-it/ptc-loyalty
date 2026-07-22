"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireBusinessContext } from "@/lib/tenant";
import { hasAtLeast } from "@/lib/rbac";
import { randomCode } from "@/lib/utils";

export interface FormResult {
  ok: boolean;
  error?: string;
}

const schema = z.object({
  title: z.string().trim().min(2, "Nhập tiêu đề"),
  code: z.string().trim().optional(),
  discountType: z.enum(["percent", "fixed", "free_item"]),
  discountValue: z.coerce.number().min(0),
  pointsCost: z.coerce.number().int().min(0),
  quantity: z.coerce.number().int().min(0).optional(),
  expiresAt: z.string().optional(),
});

export async function createVoucher(
  input: z.infer<typeof schema>,
): Promise<FormResult> {
  const ctx = await requireBusinessContext();
  if (!hasAtLeast(ctx.role, "BUSINESS_MANAGER")) {
    return { ok: false, error: "Không có quyền." };
  }
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message };
  const d = parsed.data;
  const code = (d.code?.trim() || `V-${randomCode(6)}`).toUpperCase();

  const exists = await db.voucher.findUnique({
    where: { businessId_code: { businessId: ctx.businessId, code } },
  });
  if (exists) return { ok: false, error: "Mã voucher đã tồn tại." };

  await db.voucher.create({
    data: {
      businessId: ctx.businessId,
      code,
      title: d.title,
      discountType: d.discountType,
      discountValue: d.discountValue,
      pointsCost: d.pointsCost,
      quantity: d.quantity || null,
      expiresAt: d.expiresAt ? new Date(d.expiresAt) : null,
      status: "ACTIVE",
    },
  });
  revalidatePath("/dashboard/vouchers");
  return { ok: true };
}

export async function setVoucherStatus(
  voucherId: string,
  status: "ACTIVE" | "CANCELLED",
): Promise<FormResult> {
  const ctx = await requireBusinessContext();
  if (!hasAtLeast(ctx.role, "BUSINESS_MANAGER")) {
    return { ok: false, error: "Không có quyền." };
  }
  const voucher = await db.voucher.findUnique({ where: { id: voucherId } });
  if (!voucher || voucher.businessId !== ctx.businessId) {
    return { ok: false, error: "Không tìm thấy voucher." };
  }
  await db.voucher.update({ where: { id: voucherId }, data: { status } });
  revalidatePath("/dashboard/vouchers");
  return { ok: true };
}
