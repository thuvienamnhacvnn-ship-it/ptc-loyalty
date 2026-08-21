import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, Download } from "lucide-react";
import { db } from "@/lib/db";
import { requireBusinessContext } from "@/lib/tenant";
import { hasAtLeast } from "@/lib/rbac";
import { buildTimesheet, currentMonthKey } from "@/lib/timesheet";
import { formatDuration } from "@/lib/worktime";
import { formatCurrency } from "@/lib/format";
import { PageHeader, EmptyState } from "@/components/dashboard/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const metadata: Metadata = { title: "Bảng công" };
export const dynamic = "force-dynamic";

/** "2026-08" → "Tháng 8/2026" */
function monthLabel(monthKey: string): string {
  const [y, m] = monthKey.split("-");
  return `Tháng ${Number(m)}/${y}`;
}

/** Tháng liền trước hoặc liền sau, không phụ thuộc giờ hệ thống. */
function shiftMonth(monthKey: string, delta: number): string {
  const [y, m] = monthKey.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

export default async function TimesheetPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const ctx = await requireBusinessContext();
  const isManager = hasAtLeast(ctx.role, "BUSINESS_MANAGER");
  const isOwner = hasAtLeast(ctx.role, "BUSINESS_OWNER");

  const business = await db.business.findUnique({
    where: { id: ctx.businessId },
    select: { timezone: true, currency: true },
  });
  const tz = business?.timezone || "Europe/Berlin";

  const params = await searchParams;
  const monthKey = /^\d{4}-\d{2}$/.test(params.month ?? "")
    ? (params.month as string)
    : currentMonthKey(tz);

  // Lương chỉ chủ quán xem được — quản lý xem giờ công thôi.
  const sheet = await buildTimesheet(ctx.businessId, monthKey, { includeWage: isOwner });

  // Nhân viên thường chỉ thấy dòng của chính mình.
  const rows = isManager
    ? sheet.rows
    : sheet.rows.filter((r) => r.staffId === ctx.staffProfileId);

  const visibleRows = rows.filter(
    (r) => r.workedMin > 0 || r.plannedMin > 0 || r.absenceDays > 0,
  );
  const problemCount = visibleRows.reduce(
    (sum, r) => sum + r.autoClosedCount + r.noShowCount,
    0,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bảng công"
        description="Giờ công thực tế so với ca đã xếp. Xuất CSV để gửi kế toán lương."
        action={
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href={`/dashboard/timesheet?month=${shiftMonth(monthKey, -1)}`}>Tháng trước</Link>
            </Button>
            <span className="min-w-[120px] text-center text-sm font-medium">
              {monthLabel(monthKey)}
            </span>
            <Button asChild variant="outline" size="sm">
              <Link href={`/dashboard/timesheet?month=${shiftMonth(monthKey, 1)}`}>Tháng sau</Link>
            </Button>
            {isManager && (
              <Button asChild size="sm">
                <Link href={`/dashboard/timesheet/export?month=${monthKey}`}>
                  <Download className="h-4 w-4" /> CSV
                </Link>
              </Button>
            )}
          </div>
        }
      />

      {problemCount > 0 && (
        <Card className="border-warning/40 bg-warning/5">
          <CardContent className="flex items-start gap-3 p-4 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            <p>
              Tháng này có <strong>{problemCount}</strong> chỗ cần sửa tay: ca quên quét ra hoặc có
              ca mà không ai chấm công. Giờ công của những chỗ đó chưa đáng tin, kiểm lại trước khi
              tính lương.
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          {visibleRows.length === 0 ? (
            <EmptyState
              title="Tháng này chưa có giờ công"
              description="Nhân viên quét thẻ ở màn hình chấm công là số liệu tự chảy về đây."
              action={
                <Button asChild>
                  <Link href="/dashboard/timeclock">Mở máy chấm công</Link>
                </Button>
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nhân viên</TableHead>
                  <TableHead className="text-right">Đã làm</TableHead>
                  <TableHead className="text-right">Đã xếp</TableHead>
                  <TableHead className="text-right">Chênh</TableHead>
                  <TableHead className="text-right">Đi muộn</TableHead>
                  <TableHead className="text-right">Ngày nghỉ</TableHead>
                  {isOwner && <TableHead className="text-right">Lương</TableHead>}
                  <TableHead>Cảnh báo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleRows.map((r) => {
                  const diff = r.workedMin - r.plannedMin;
                  return (
                    <TableRow key={r.staffId}>
                      <TableCell>
                        <span className="font-medium">{r.name}</span>
                        <span className="block text-xs text-muted-foreground">
                          {r.departmentName ?? "—"}
                          {r.employeeNo ? ` · ${r.employeeNo}` : ""}
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        {formatDuration(r.workedMin)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {formatDuration(r.plannedMin)}
                      </TableCell>
                      <TableCell
                        className={`text-right tabular-nums ${
                          diff < 0 ? "text-destructive" : diff > 0 ? "text-success" : ""
                        }`}
                      >
                        {diff === 0 ? "—" : `${diff > 0 ? "+" : ""}${formatDuration(diff)}`}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {r.lateCount === 0 ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          `${r.lateCount}× (${r.lateMin}′)`
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {r.absenceDays || <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      {isOwner && (
                        <TableCell className="text-right tabular-nums">
                          {r.wageCents == null ? (
                            <span className="text-muted-foreground">—</span>
                          ) : (
                            formatCurrency(r.wageCents / 100, business?.currency ?? "EUR")
                          )}
                        </TableCell>
                      )}
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {r.autoClosedCount > 0 && (
                            <Badge variant="destructive">
                              {r.autoClosedCount} ca quên quét ra
                            </Badge>
                          )}
                          {r.noShowCount > 0 && (
                            <Badge variant="warning">{r.noShowCount} ca không tới</Badge>
                          )}
                          {r.issues.map((i) => (
                            <Badge key={i.code} variant="warning" title={i.message}>
                              {ISSUE_SHORT[i.code]}
                            </Badge>
                          ))}
                          {r.autoClosedCount === 0 &&
                            r.noShowCount === 0 &&
                            r.issues.length === 0 && (
                              <span className="text-xs text-muted-foreground">Sạch</span>
                            )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {visibleRows.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="text-muted-foreground">
            Tổng giờ công tháng này:{" "}
            <strong className="text-foreground">{formatDuration(sheet.totalWorkedMin)}</strong>
          </span>
          {isOwner && sheet.totalWageCents != null && (
            <span className="text-muted-foreground">
              Tổng lương ước tính:{" "}
              <strong className="text-foreground">
                {formatCurrency(sheet.totalWageCents / 100, business?.currency ?? "EUR")}
              </strong>
            </span>
          )}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Giờ nghỉ được trừ theo luật giờ làm việc Đức: trên 6 tiếng trừ 30 phút, trên 9 tiếng trừ 45
        phút. Đổi quy tắc này trong phần cài đặt chấm công.
      </p>
    </div>
  );
}

const ISSUE_SHORT: Record<string, string> = {
  OVER_DAILY_LIMIT: "Quá 10h/ngày",
  BREAK_TOO_SHORT: "Thiếu giờ nghỉ",
  REST_TOO_SHORT: "Nghỉ giữa ca ngắn",
};
