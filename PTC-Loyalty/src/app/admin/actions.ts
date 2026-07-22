"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/tenant";
import type { BusinessStatus } from "@prisma/client";

export async function setBusinessStatus(
  businessId: string,
  status: BusinessStatus,
): Promise<{ ok: boolean; error?: string }> {
  const admin = await requirePlatformAdmin();
  await db.business.update({ where: { id: businessId }, data: { status } });
  await db.auditLog.create({
    data: {
      businessId,
      userId: admin.id,
      action: `admin.business.${status.toLowerCase()}`,
      entity: "Business",
      entityId: businessId,
    },
  });
  revalidatePath(`/admin/businesses/${businessId}`);
  revalidatePath("/admin/businesses");
  return { ok: true };
}

export async function resolveFraudAlert(
  alertId: string,
): Promise<{ ok: boolean; error?: string }> {
  await requirePlatformAdmin();
  await db.fraudAlert.update({
    where: { id: alertId },
    data: { resolvedAt: new Date() },
  });
  revalidatePath("/admin/fraud");
  return { ok: true };
}
