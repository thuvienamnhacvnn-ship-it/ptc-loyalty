import crypto from "node:crypto";
import { db } from "@/lib/db";
import { sendEmail, birthdayEmailHtml, winbackEmailHtml } from "@/lib/email";
import { formatDate } from "@/lib/format";

const DAY = 24 * 60 * 60 * 1000;

function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

/**
 * Send birthday greetings (once per year per customer) to customers whose
 * birthday is today. Issues the business's auto-birthday voucher when one is set.
 * NOTE: month/day is filtered in JS (Prisma can't extract them portably). Fine
 * for typical tenant sizes; use a raw query if this ever needs to scale hard.
 */
export async function runBirthdayGreetings(): Promise<{
  processed: number;
  emailed: number;
  vouchers: number;
}> {
  const now = new Date();
  const month = now.getUTCMonth() + 1;
  const day = now.getUTCDate();
  const year = now.getUTCFullYear();

  const candidates = await db.customerProfile.findMany({
    where: {
      birthDate: { not: null },
      email: { not: null },
      isBlocked: false,
      isAnonymized: false,
    },
    select: {
      id: true,
      businessId: true,
      firstName: true,
      lastName: true,
      email: true,
      birthDate: true,
      lastBirthdayGreetingAt: true,
      business: { select: { name: true } },
    },
    take: 2000,
  });

  let processed = 0;
  let emailed = 0;
  let vouchers = 0;

  for (const c of candidates) {
    const b = c.birthDate!;
    if (b.getUTCMonth() + 1 !== month || b.getUTCDate() !== day) continue;
    if (c.lastBirthdayGreetingAt && c.lastBirthdayGreetingAt.getUTCFullYear() === year) continue;
    processed++;

    // Issue the business's birthday voucher if one is configured & active.
    let voucherCode: string | null = null;
    let voucherTitle: string | null = null;
    let expiresStr: string | null = null;
    const voucher = await db.voucher.findFirst({
      where: { businessId: c.businessId, autoBirthday: true, status: "ACTIVE" },
    });
    if (voucher) {
      const code = `BDAY-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
      const expires = new Date(now.getTime() + 30 * DAY); // valid ~1 month
      try {
        await db.customerVoucher.create({
          data: {
            businessId: c.businessId,
            voucherId: voucher.id,
            customerId: c.id,
            code,
            status: "ISSUED",
            expiresAt: expires,
          },
        });
        await db.voucher.update({
          where: { id: voucher.id },
          data: { issuedCount: { increment: 1 } },
        });
        voucherCode = code;
        voucherTitle = voucher.title;
        expiresStr = formatDate(expires);
        vouchers++;
      } catch (e) {
        console.error("[retention] birthday voucher failed:", e instanceof Error ? e.message : e);
      }
    }

    const name = `${c.firstName} ${c.lastName ?? ""}`.trim();
    await sendEmail({
      to: c.email!,
      subject: `🎂 Chúc mừng sinh nhật từ ${c.business.name}`,
      text: `Chúc mừng sinh nhật ${name}!${voucherCode ? ` Mã ưu đãi: ${voucherCode}` : ""}`,
      html: birthdayEmailHtml({
        name,
        storeName: c.business.name,
        voucherCode,
        voucherTitle,
        expires: expiresStr,
      }),
    });
    emailed++;
    await db.customerProfile.update({
      where: { id: c.id },
      data: { lastBirthdayGreetingAt: now },
    });
  }

  return { processed, emailed, vouchers };
}

/**
 * Send a "we miss you" email to customers inactive for ≥3 weeks (and ≤120 days,
 * to avoid pinging very stale records). One reminder per inactivity episode:
 * re-eligible only after the customer visits again (lastVisitAt > lastReengagedAt).
 */
export async function runWinback(): Promise<{ processed: number; emailed: number }> {
  const now = new Date();
  const inactiveSince = new Date(now.getTime() - 21 * DAY); // ≥ 3 weeks
  const floor = new Date(now.getTime() - 120 * DAY);

  const candidates = await db.customerProfile.findMany({
    where: {
      email: { not: null },
      isBlocked: false,
      isAnonymized: false,
      lastVisitAt: { not: null, lt: inactiveSince, gte: floor },
    },
    select: {
      id: true,
      firstName: true,
      email: true,
      pointsBalance: true,
      lastVisitAt: true,
      lastReengagedAt: true,
      business: { select: { name: true, slug: true } },
    },
    take: 1000,
  });

  let processed = 0;
  let emailed = 0;

  for (const c of candidates) {
    // Skip if we already reminded since their last visit.
    if (c.lastReengagedAt && c.lastVisitAt && c.lastReengagedAt > c.lastVisitAt) continue;
    processed++;

    await sendEmail({
      to: c.email!,
      subject: `Chúng tôi nhớ bạn 👋 — ${c.business.name}`,
      text: `Chào ${c.firstName}, đã lâu bạn chưa ghé ${c.business.name}. Bạn đang có ${c.pointsBalance} điểm.`,
      html: winbackEmailHtml({
        name: c.firstName,
        storeName: c.business.name,
        pointsBalance: c.pointsBalance,
        url: `${appUrl()}/business/${c.business.slug}`,
      }),
    });
    emailed++;
    await db.customerProfile.update({
      where: { id: c.id },
      data: { lastReengagedAt: now },
    });
  }

  return { processed, emailed };
}
