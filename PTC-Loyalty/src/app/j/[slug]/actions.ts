"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { db } from "@/lib/db";
import { generateMemberCode } from "@/lib/utils";
import { recalcTier } from "@/lib/transactions";
import { toWhatsAppNumber } from "@/lib/phone";
import { renderMemberQrPng } from "@/lib/member-qr";
import { sendMemberCardWhatsApp } from "@/lib/whatsapp/membership-card";

/**
 * Public self-signup at the table: the customer scans the restaurant's QR,
 * types name + phone, and immediately gets their membership QR on WhatsApp —
 * sent from the restaurant's OWN number.
 *
 * No account, no password, no email. The only identity is the phone number.
 */

export interface QuickJoinState {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
  /** Shown on screen as well, so the customer has the QR even if WhatsApp fails. */
  member?: {
    name: string;
    memberCode: string;
    qrDataUrl: string;
    /** sent | no_phone | not_connected | toggle_off | <error> */
    whatsapp: string;
    bonusPoints: number;
  };
}

const schema = z.object({
  slug: z.string().min(1),
  firstName: z.string().trim().min(1, "Nhập tên của bạn").max(80),
  phone: z.string().trim().min(6, "Nhập số điện thoại WhatsApp"),
  consent: z.literal(true, {
    errorMap: () => ({ message: "Cần đồng ý nhận tin nhắn để gửi thẻ QR cho bạn." }),
  }),
});

/** Cheap per-IP throttle so a public form can't be used to spam-create members. */
const SIGNUP_WINDOW_MS = 10 * 60 * 1000;
const SIGNUP_MAX = 8;

async function throttled(): Promise<boolean> {
  const h = await headers();
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  const key = `quick-join:${ip}`;
  const now = new Date();

  const record = await db.loginAttempt.findUnique({ where: { key } });
  if (record?.blockedUntil && record.blockedUntil > now) return true;

  if (!record || now.getTime() - record.windowStart.getTime() > SIGNUP_WINDOW_MS) {
    await db.loginAttempt.upsert({
      where: { key },
      create: { key, count: 1, windowStart: now, blockedUntil: null },
      update: { count: 1, windowStart: now, blockedUntil: null },
    });
    return false;
  }

  const count = record.count + 1;
  const blockedUntil =
    count >= SIGNUP_MAX ? new Date(now.getTime() + SIGNUP_WINDOW_MS) : record.blockedUntil;
  await db.loginAttempt.update({ where: { key }, data: { count, blockedUntil } });
  return count >= SIGNUP_MAX;
}

export async function quickJoin(
  _prev: QuickJoinState,
  formData: FormData,
): Promise<QuickJoinState> {
  const parsed = schema.safeParse({
    slug: formData.get("slug"),
    firstName: formData.get("firstName"),
    phone: formData.get("phone"),
    consent: formData.get("consent") === "on",
  });
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const d = parsed.data;

  const phone = toWhatsAppNumber(d.phone);
  if (!phone) {
    return { fieldErrors: { phone: ["Số điện thoại không hợp lệ. Ví dụ: 0151 2345678"] } };
  }

  if (await throttled()) {
    return { error: "Bạn thử quá nhiều lần. Vui lòng đợi ít phút rồi thử lại." };
  }

  const business = await db.business.findUnique({
    where: { slug: d.slug },
    include: { setting: true },
  });
  if (!business || business.status === "SUSPENDED") {
    return { error: "Nhà hàng không khả dụng." };
  }

  // Already a member? Don't create a duplicate — just re-send their card, which
  // is exactly what someone who lost the message wants.
  const existing = await db.customerProfile.findFirst({
    where: { businessId: business.id, phone },
    select: { id: true, memberCode: true, qrSecret: true, firstName: true, lastName: true },
  });
  if (existing) {
    const qr = await renderMemberQrPng({
      businessId: business.id,
      customerId: existing.id,
      memberCode: existing.memberCode,
      secret: existing.qrSecret,
    });
    const resend = await sendMemberCardWhatsApp({
      businessId: business.id,
      customerId: existing.id,
      memberCode: existing.memberCode,
      qrSecret: existing.qrSecret,
      name: `${existing.firstName} ${existing.lastName ?? ""}`.trim(),
      storeName: business.name,
      toPhone: phone,
    });
    return {
      ok: true,
      member: {
        name: `${existing.firstName} ${existing.lastName ?? ""}`.trim(),
        memberCode: existing.memberCode,
        qrDataUrl: qr.dataUrl,
        whatsapp: resend.ok ? "sent" : resend.skipped ?? resend.error ?? "failed",
        bonusPoints: 0,
      },
    };
  }

  const signupBonus = business.setting?.signupBonus ?? 0;

  const created = await db.$transaction(async (tx) => {
    const customer = await tx.customerProfile.create({
      data: {
        businessId: business.id,
        memberCode: generateMemberCode(),
        firstName: d.firstName,
        phone,
        pointsBalance: signupBonus,
        totalEarned: signupBonus,
      },
      select: { id: true, memberCode: true, qrSecret: true, firstName: true },
    });

    // The customer typed their number specifically to receive the card, so the
    // transactional opt-in is explicit and timestamped. Marketing stays off.
    await tx.customerCommunicationConsent.create({
      data: {
        businessId: business.id,
        customerId: customer.id,
        whatsappPhone: phone,
        whatsappTransactional: true,
        transactionalConsentAt: new Date(),
      },
    });

    if (signupBonus > 0) {
      await tx.transaction.create({
        data: {
          businessId: business.id,
          customerId: customer.id,
          type: "BONUS",
          status: "COMPLETED",
          points: signupBonus,
          balanceBefore: 0,
          balanceAfter: signupBonus,
          note: "Điểm thưởng đăng ký",
        },
      });
    }
    return customer;
  });

  await recalcTier(business.id, created.id);

  // Reuse the identity QR the platform already generates — same token the staff
  // scanner reads.
  const qr = await renderMemberQrPng({
    businessId: business.id,
    customerId: created.id,
    memberCode: created.memberCode,
    secret: created.qrSecret,
  });

  // Welcome + QR image + instructions, from the restaurant's own WhatsApp.
  const sent = await sendMemberCardWhatsApp({
    businessId: business.id,
    customerId: created.id,
    memberCode: created.memberCode,
    qrSecret: created.qrSecret,
    name: created.firstName,
    storeName: business.name,
    toPhone: phone,
  });

  return {
    ok: true,
    member: {
      name: created.firstName,
      memberCode: created.memberCode,
      qrDataUrl: qr.dataUrl,
      whatsapp: sent.ok ? "sent" : sent.skipped ?? sent.error ?? "failed",
      bonusPoints: signupBonus,
    },
  };
}
