import { db } from "@/lib/db";
import { requireBusinessContext } from "@/lib/tenant";
import { hasAtLeast } from "@/lib/rbac";
import { buildTimesheet, currentMonthKey } from "@/lib/timesheet";

function csvCell(value: unknown): string {
  const s = value == null ? "" : String(value);
  return `"${s.replace(/"/g, '""')}"`;
}

/** Phút → "8,25" giờ. Kế toán Đức đọc dấu phẩy thập phân, không đọc "8h15". */
function hoursDe(minutes: number): string {
  return (minutes / 60).toFixed(2).replace(".", ",");
}

/**
 * GET /dashboard/timesheet/export?month=2026-08
 * Bảng công tháng dạng CSV để gửi văn phòng lương (Lohnbüro).
 */
export async function GET(request: Request) {
  const ctx = await requireBusinessContext();
  if (!hasAtLeast(ctx.role, "BUSINESS_MANAGER")) {
    return new Response("Forbidden", { status: 403 });
  }

  const business = await db.business.findUnique({
    where: { id: ctx.businessId },
    select: { timezone: true, name: true },
  });
  const url = new URL(request.url);
  const requested = url.searchParams.get("month") ?? "";
  const monthKey = /^\d{4}-\d{2}$/.test(requested)
    ? requested
    : currentMonthKey(business?.timezone || "Europe/Berlin");

  const includeWage = hasAtLeast(ctx.role, "BUSINESS_OWNER");
  const sheet = await buildTimesheet(ctx.businessId, monthKey, { includeWage });

  const header = [
    "Mã nhân viên",
    "Tên",
    "Bộ phận",
    "Giờ đã làm",
    "Giờ đã xếp",
    "Chênh lệch",
    "Số lần đi muộn",
    "Phút đi muộn",
    "Phút về sớm",
    "Ngày nghỉ",
    "Ca quên quét ra",
    "Ca không tới",
    ...(includeWage ? ["Lương ước tính (EUR)"] : []),
  ];

  const rows = sheet.rows
    .filter((r) => r.workedMin > 0 || r.plannedMin > 0 || r.absenceDays > 0)
    .map((r) =>
      [
        r.employeeNo,
        r.name,
        r.departmentName,
        hoursDe(r.workedMin),
        hoursDe(r.plannedMin),
        hoursDe(r.workedMin - r.plannedMin),
        r.lateCount,
        r.lateMin,
        r.earlyLeaveMin,
        r.absenceDays,
        r.autoClosedCount,
        r.noShowCount,
        ...(includeWage ? [r.wageCents == null ? "" : (r.wageCents / 100).toFixed(2).replace(".", ",")] : []),
      ]
        .map(csvCell)
        .join(";"),
    );

  // Dấu chấm phẩy + BOM: Excel bản tiếng Đức mở CSV dấu phẩy ra một cột dính liền.
  const csv = ["﻿" + header.join(";"), ...rows].join("\r\n");
  const safeName = (business?.name ?? "quan").replace(/[^\w\-]+/g, "-").slice(0, 40);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="bang-cong-${safeName}-${monthKey}.csv"`,
    },
  });
}
