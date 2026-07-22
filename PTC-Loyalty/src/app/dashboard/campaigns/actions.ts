"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireBusinessContext } from "@/lib/tenant";
import { hasAtLeast } from "@/lib/rbac";

const schema = z.object({
  name: z.string().trim().min(2, "Nhập tên chiến dịch"),
  subject: z.string().trim().min(2, "Nhập tiêu đề"),
  body: z.string().trim().min(2, "Nhập nội dung"),
  audience: z.enum(["all", "consented", "inactive_30d", "top_tier"]),
});

/** Resolve the target customers for an audience segment (tenant-scoped). */
async function resolveAudience(businessId: string, audience: string) {
  const base: Prisma.CustomerProfileWhereInput = { businessId, isBlocked: false };
  if (audience === "consented") base.marketingConsent = true;
  if (audience === "inactive_30d") {
    base.lastVisitAt = { lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) };
  }
  if (audience === "top_tier") {
    base.membership = { tier: { level: { gte: 3 } } };
  }
  return db.customerProfile.findMany({
    where: base,
    select: { id: true, userId: true },
  });
}

export async function createAndSendCampaign(
  input: z.infer<typeof schema>,
): Promise<{ ok: boolean; error?: string; recipients?: number }> {
  const ctx = await requireBusinessContext();
  if (!hasAtLeast(ctx.role, "BUSINESS_MANAGER")) {
    return { ok: false, error: "Không có quyền." };
  }
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message };
  const d = parsed.data;

  const targets = await resolveAudience(ctx.businessId, d.audience);
  const now = new Date();

  const campaign = await db.campaign.create({
    data: {
      businessId: ctx.businessId,
      name: d.name,
      subject: d.subject,
      body: d.body,
      audience: { segment: d.audience },
      channel: "inapp",
      status: "SENT",
      sentAt: now,
    },
  });

  if (targets.length > 0) {
    await db.campaignRecipient.createMany({
      data: targets.map((t) => ({
        campaignId: campaign.id,
        customerId: t.id,
        sentAt: now,
      })),
    });
    // In-app notifications for customers who have a linked user account.
    const withUser = targets.filter((t) => t.userId);
    if (withUser.length > 0) {
      await db.notification.createMany({
        data: withUser.map((t) => ({
          userId: t.userId!,
          businessId: ctx.businessId,
          type: "OFFER" as const,
          title: d.subject,
          body: d.body,
        })),
      });
    }
  }

  // NOTE: email delivery is mocked. Wire Resend/SendGrid here in production.
  revalidatePath("/dashboard/campaigns");
  return { ok: true, recipients: targets.length };
}
