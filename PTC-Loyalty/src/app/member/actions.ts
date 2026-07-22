"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/tenant";
import { randomCode } from "@/lib/utils";
import { notifyRewardRedeemed, notifyVoucherIssued } from "@/lib/whatsapp/service";

export interface FormResult {
  ok: boolean;
  error?: string;
}

async function getMyProfile(userId: string) {
  return db.customerProfile.findFirst({ where: { userId } });
}

/** Customer redeems a catalog reward with their own points. */
export async function redeemReward(rewardId: string): Promise<FormResult> {
  const user = await requireUser();
  const profile = await getMyProfile(user.id);
  if (!profile) return { ok: false, error: "Không tìm thấy hồ sơ thành viên." };
  if (profile.isBlocked) return { ok: false, error: "Tài khoản đang bị khóa." };

  const reward = await db.reward.findUnique({ where: { id: rewardId } });
  if (!reward || reward.businessId !== profile.businessId) {
    return { ok: false, error: "Không tìm thấy quà." };
  }
  if (reward.status !== "ACTIVE") return { ok: false, error: "Quà không còn khả dụng." };
  if (reward.stock != null && reward.stock <= 0) {
    return { ok: false, error: "Quà đã hết." };
  }
  if (profile.pointsBalance < reward.pointsCost) {
    return { ok: false, error: "Bạn không đủ điểm để đổi quà này." };
  }

  const balanceAfter = profile.pointsBalance - reward.pointsCost;

  const redeemTxnId = await db.$transaction(async (tx) => {
    const created = await tx.transaction.create({
      data: {
        businessId: profile.businessId,
        customerId: profile.id,
        type: "REDEEM",
        status: "COMPLETED",
        points: -reward.pointsCost,
        balanceBefore: profile.pointsBalance,
        balanceAfter,
        note: `Đổi quà: ${reward.name}`,
      },
    });
    await tx.rewardRedemption.create({
      data: {
        businessId: profile.businessId,
        rewardId: reward.id,
        customerId: profile.id,
        pointsSpent: reward.pointsCost,
        status: "PENDING",
      },
    });
    await tx.customerProfile.update({
      where: { id: profile.id },
      data: {
        pointsBalance: balanceAfter,
        totalRedeemed: { increment: reward.pointsCost },
      },
    });
    if (reward.stock != null) {
      await tx.reward.update({
        where: { id: reward.id },
        data: { stock: { decrement: 1 } },
      });
    }
    return created.id;
  });

  try {
    const business = await db.business.findUnique({
      where: { id: profile.businessId },
      select: { name: true },
    });
    await notifyRewardRedeemed({
      businessId: profile.businessId,
      customerId: profile.id,
      transactionId: redeemTxnId,
      pointsSpent: reward.pointsCost,
      balanceAfter,
      storeName: business?.name ?? "PTC Loyalty",
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[whatsapp] member redeem notification failed:", err);
  }

  revalidatePath("/member/rewards");
  revalidatePath("/member");
  return { ok: true };
}

/** Customer claims a business voucher using points. */
export async function claimVoucher(voucherId: string): Promise<FormResult> {
  const user = await requireUser();
  const profile = await getMyProfile(user.id);
  if (!profile) return { ok: false, error: "Không tìm thấy hồ sơ." };

  const voucher = await db.voucher.findUnique({ where: { id: voucherId } });
  if (!voucher || voucher.businessId !== profile.businessId) {
    return { ok: false, error: "Không tìm thấy voucher." };
  }
  if (voucher.status !== "ACTIVE") return { ok: false, error: "Voucher không khả dụng." };
  if (voucher.expiresAt && voucher.expiresAt < new Date()) {
    return { ok: false, error: "Voucher đã hết hạn." };
  }

  const alreadyClaimed = await db.customerVoucher.count({
    where: { voucherId, customerId: profile.id },
  });
  if (alreadyClaimed >= voucher.perCustomerLimit) {
    return { ok: false, error: "Bạn đã đạt giới hạn nhận voucher này." };
  }
  if (voucher.pointsCost > 0 && profile.pointsBalance < voucher.pointsCost) {
    return { ok: false, error: "Bạn không đủ điểm để đổi voucher." };
  }

  const claimedVoucherId = await db.$transaction(async (tx) => {
    if (voucher.pointsCost > 0) {
      const balanceAfter = profile.pointsBalance - voucher.pointsCost;
      await tx.transaction.create({
        data: {
          businessId: profile.businessId,
          customerId: profile.id,
          type: "REDEEM",
          status: "COMPLETED",
          points: -voucher.pointsCost,
          balanceBefore: profile.pointsBalance,
          balanceAfter,
          note: `Đổi voucher: ${voucher.title}`,
        },
      });
      await tx.customerProfile.update({
        where: { id: profile.id },
        data: {
          pointsBalance: balanceAfter,
          totalRedeemed: { increment: voucher.pointsCost },
        },
      });
    }
    const claimed = await tx.customerVoucher.create({
      data: {
        businessId: profile.businessId,
        voucherId: voucher.id,
        customerId: profile.id,
        code: `${voucher.code}-${randomCode(4)}`,
        expiresAt: voucher.expiresAt,
      },
    });
    await tx.voucher.update({
      where: { id: voucher.id },
      data: { issuedCount: { increment: 1 } },
    });
    return claimed.id;
  });

  try {
    const business = await db.business.findUnique({
      where: { id: profile.businessId },
      select: { name: true },
    });
    await notifyVoucherIssued({
      businessId: profile.businessId,
      customerId: profile.id,
      customerVoucherId: claimedVoucherId,
      voucherTitle: voucher.title,
      storeName: business?.name ?? "PTC Loyalty",
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[whatsapp] voucher notification failed:", err);
  }

  revalidatePath("/member/vouchers");
  return { ok: true };
}

const profileSchema = z.object({
  phone: z.string().trim().optional(),
  locale: z.enum(["vi", "de", "en"]),
  marketingConsent: z.coerce.boolean().optional(),
  // WhatsApp consent is tracked separately: transactional vs marketing.
  whatsappPhone: z.string().trim().optional(),
  whatsappTransactional: z.coerce.boolean().optional(),
  whatsappMarketing: z.coerce.boolean().optional(),
});

export async function updateMyProfile(
  input: z.infer<typeof profileSchema>,
): Promise<FormResult> {
  const user = await requireUser();
  const profile = await getMyProfile(user.id);
  if (!profile) return { ok: false, error: "Không tìm thấy hồ sơ." };
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Dữ liệu không hợp lệ." };
  const d = parsed.data;

  await db.customerProfile.update({
    where: { id: profile.id },
    data: {
      phone: d.phone || null,
      locale: d.locale,
      marketingConsent: !!d.marketingConsent,
    },
  });

  // Upsert the separate communication-consent record. Timestamp each grant.
  const now = new Date();
  const wantsTransactional = !!d.whatsappTransactional;
  const wantsMarketing = !!d.whatsappMarketing;
  const existing = await db.customerCommunicationConsent.findUnique({
    where: { customerId: profile.id },
  });
  await db.customerCommunicationConsent.upsert({
    where: { customerId: profile.id },
    create: {
      businessId: profile.businessId,
      customerId: profile.id,
      whatsappPhone: d.whatsappPhone || null,
      whatsappTransactional: wantsTransactional,
      whatsappMarketing: wantsMarketing,
      transactionalConsentAt: wantsTransactional ? now : null,
      marketingConsentAt: wantsMarketing ? now : null,
    },
    update: {
      whatsappPhone: d.whatsappPhone || null,
      whatsappTransactional: wantsTransactional,
      whatsappMarketing: wantsMarketing,
      transactionalConsentAt:
        wantsTransactional && !existing?.whatsappTransactional
          ? now
          : existing?.transactionalConsentAt ?? (wantsTransactional ? now : null),
      marketingConsentAt:
        wantsMarketing && !existing?.whatsappMarketing
          ? now
          : existing?.marketingConsentAt ?? (wantsMarketing ? now : null),
    },
  });

  revalidatePath("/member/profile");
  return { ok: true };
}
