"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireBusinessContext } from "@/lib/tenant";
import { hasAtLeast } from "@/lib/rbac";

const schema = z.object({
  name: z.string().trim().min(2, "Nhập tên chi nhánh"),
  city: z.string().trim().optional(),
  addressLine: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  openingHours: z.string().trim().optional(),
});

export async function createBranch(
  input: z.infer<typeof schema>,
): Promise<{ ok: boolean; error?: string }> {
  const ctx = await requireBusinessContext();
  if (!hasAtLeast(ctx.role, "BUSINESS_MANAGER")) {
    return { ok: false, error: "Không có quyền." };
  }
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message };

  // Enforce plan branch limit.
  const [count, sub] = await Promise.all([
    db.branch.count({ where: { businessId: ctx.businessId } }),
    db.subscription.findUnique({
      where: { businessId: ctx.businessId },
      include: { plan: true },
    }),
  ]);
  if (sub && count >= sub.plan.maxBranches) {
    return { ok: false, error: `Gói ${sub.plan.name} chỉ cho phép ${sub.plan.maxBranches} chi nhánh.` };
  }

  const d = parsed.data;
  await db.branch.create({
    data: {
      businessId: ctx.businessId,
      name: d.name,
      city: d.city || null,
      addressLine: d.addressLine || null,
      phone: d.phone || null,
      openingHours: d.openingHours || null,
    },
  });
  revalidatePath("/dashboard/branches");
  return { ok: true };
}
