"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireBusinessContext } from "@/lib/tenant";
import { hasAtLeast } from "@/lib/rbac";

const schema = z.object({
  name: z.string().trim().min(2, "Nhập tên quà"),
  description: z.string().trim().optional(),
  pointsCost: z.coerce.number().int().positive("Điểm phải lớn hơn 0"),
  stock: z.coerce.number().int().min(0).optional(),
  imageUrl: z.string().url().optional().or(z.literal("")),
});

export async function createReward(
  input: z.infer<typeof schema>,
): Promise<{ ok: boolean; error?: string }> {
  const ctx = await requireBusinessContext();
  if (!hasAtLeast(ctx.role, "BUSINESS_MANAGER")) {
    return { ok: false, error: "Không có quyền." };
  }
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message };
  const d = parsed.data;
  await db.reward.create({
    data: {
      businessId: ctx.businessId,
      name: d.name,
      description: d.description || null,
      pointsCost: d.pointsCost,
      stock: d.stock ?? null,
      imageUrl: d.imageUrl || null,
      status: "ACTIVE",
    },
  });
  revalidatePath("/dashboard/rewards");
  return { ok: true };
}
