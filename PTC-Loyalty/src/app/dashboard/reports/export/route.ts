import { db } from "@/lib/db";
import { requireBusinessContext } from "@/lib/tenant";

function csvCell(value: unknown): string {
  const s = value == null ? "" : String(value);
  return `"${s.replace(/"/g, '""')}"`;
}

export async function GET() {
  const ctx = await requireBusinessContext();
  const transactions = await db.transaction.findMany({
    where: { businessId: ctx.businessId },
    orderBy: { createdAt: "desc" },
    take: 5000,
    include: {
      customer: { select: { memberCode: true } },
      branch: { select: { name: true } },
    },
  });

  const header = [
    "id",
    "createdAt",
    "type",
    "status",
    "memberCode",
    "branch",
    "amountEUR",
    "points",
    "balanceBefore",
    "balanceAfter",
    "note",
  ];
  const rows = transactions.map((t) =>
    [
      t.id,
      t.createdAt.toISOString(),
      t.type,
      t.status,
      t.customer.memberCode,
      t.branch?.name,
      t.amount,
      t.points,
      t.balanceBefore,
      t.balanceAfter,
      t.note,
    ]
      .map(csvCell)
      .join(","),
  );

  const csv = [header.join(","), ...rows].join("\r\n");
  return new Response("﻿" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="transactions-${Date.now()}.csv"`,
    },
  });
}
