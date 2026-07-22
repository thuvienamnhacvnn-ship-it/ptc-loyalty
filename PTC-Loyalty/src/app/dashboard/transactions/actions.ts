"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireBusinessContext } from "@/lib/tenant";
import { hasAtLeast } from "@/lib/rbac";
import { reverseTransaction } from "@/lib/transactions";

const schema = z.object({
  transactionId: z.string().min(1),
  reason: z.string().trim().min(3, "Nhập lý do hoàn tác"),
});

export async function reverseTxnAction(
  input: z.infer<typeof schema>,
): Promise<{ ok: boolean; error?: string }> {
  const ctx = await requireBusinessContext();
  if (!hasAtLeast(ctx.role, "BUSINESS_MANAGER")) {
    return { ok: false, error: "Chỉ quản lý/chủ mới được hoàn tác giao dịch." };
  }
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message };

  const result = await reverseTransaction(
    ctx,
    parsed.data.transactionId,
    parsed.data.reason,
  );
  if (!result.ok) {
    const map: Record<string, string> = {
      not_found: "Không tìm thấy giao dịch.",
      already_reversed: "Giao dịch đã được hoàn tác.",
    };
    return { ok: false, error: map[result.error] ?? "Hoàn tác thất bại." };
  }
  revalidatePath("/dashboard/transactions");
  return { ok: true };
}
