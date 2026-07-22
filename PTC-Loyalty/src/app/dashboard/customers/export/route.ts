import { db } from "@/lib/db";
import { requireBusinessContext } from "@/lib/tenant";

function csvCell(value: unknown): string {
  const s = value == null ? "" : String(value);
  return `"${s.replace(/"/g, '""')}"`;
}

export async function GET() {
  const ctx = await requireBusinessContext();
  const customers = await db.customerProfile.findMany({
    where: { businessId: ctx.businessId },
    orderBy: { createdAt: "desc" },
    include: { membership: { include: { tier: true } } },
  });

  const header = [
    "memberCode",
    "firstName",
    "lastName",
    "email",
    "phone",
    "tier",
    "pointsBalance",
    "totalEarned",
    "totalRedeemed",
    "visitCount",
    "marketingConsent",
    "joinedAt",
  ];

  const rows = customers.map((c) =>
    [
      c.memberCode,
      c.firstName,
      c.lastName,
      c.email,
      c.phone,
      c.membership?.tier.name,
      c.pointsBalance,
      c.totalEarned,
      c.totalRedeemed,
      c.visitCount,
      c.marketingConsent,
      c.joinedAt.toISOString(),
    ]
      .map(csvCell)
      .join(","),
  );

  const csv = [header.join(","), ...rows].join("\r\n");
  return new Response("﻿" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="customers-${Date.now()}.csv"`,
    },
  });
}
