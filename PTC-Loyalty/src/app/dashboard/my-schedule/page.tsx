import type { Metadata } from "next";
import Link from "next/link";
import { CalendarOff, Clock } from "lucide-react";
import { db } from "@/lib/db";
import { requireBusinessContext } from "@/lib/tenant";
import { getWorkTimeSetting } from "@/lib/worktime-setup";
import { computeWorked, formatDuration, formatHhMm, localDateKey, shiftSpanMinutes } from "@/lib/worktime";
import {
  addDays,
  dateKeyToUtcDate,
  mondayOf,
  utcDateToKey,
  weekDateKeys,
  WEEKDAY_LABELS_VI,
} from "@/lib/schedule";
import { monthBounds, currentMonthKey } from "@/lib/timesheet";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Ca của tôi" };
export const dynamic = "force-dynamic";

const ABSENCE_LABELS: Record<string, string> = {
  SICK: "Báo ốm",
  VACATION: "Nghỉ phép",
  UNPAID: "Nghỉ không lương",
  TRAINING: "Đào tạo",
  OTHER: "Nghỉ",
};

/**
 * Màn hình của chính nhân viên: tuần này tôi làm ca nào, tháng này tôi được
 * bao nhiêu giờ, và nút báo ốm. Cố ý KHÔNG hiện lịch người khác — nhân viên
 * không có việc gì phải xem giờ công của đồng nghiệp.
 */
export default async function MySchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const ctx = await requireBusinessContext();

  const business = await db.business.findUnique({
    where: { id: ctx.businessId },
    select: { timezone: true },
  });
  const tz = business?.timezone || "Europe/Berlin";
  const setting = await getWorkTimeSetting(ctx.businessId);

  const params = await searchParams;
  const requested = /^\d{4}-\d{2}-\d{2}$/.test(params.week ?? "")
    ? (params.week as string)
    : localDateKey(new Date(), tz);
  const monday = mondayOf(requested);
  const weekKeys = weekDateKeys(monday);
  const monthKey = currentMonthKey(tz);
  const { firstDayKey, lastDayKey } = monthBounds(monthKey);

  const [assignments, absences, openEntry, monthEntries] = await Promise.all([
    db.shiftAssignment.findMany({
      where: {
        staffId: ctx.staffProfileId,
        status: { not: "CANCELLED" },
        date: { gte: dateKeyToUtcDate(monday), lte: dateKeyToUtcDate(weekKeys[6]) },
      },
      include: { template: { select: { name: true } }, department: { select: { name: true } } },
      orderBy: { startMinute: "asc" },
    }),
    db.staffAbsence.findMany({
      where: {
        staffId: ctx.staffProfileId,
        status: { in: ["REQUESTED", "APPROVED"] },
        endDate: { gte: dateKeyToUtcDate(monday) },
        startDate: { lte: dateKeyToUtcDate(weekKeys[6]) },
      },
      select: { type: true, status: true, startDate: true, endDate: true },
    }),
    db.timeEntry.findFirst({
      where: { staffId: ctx.staffProfileId, clockOutAt: null },
      orderBy: { clockInAt: "desc" },
    }),
    db.timeEntry.findMany({
      where: {
        staffId: ctx.staffProfileId,
        clockInAt: {
          gte: dateKeyToUtcDate(firstDayKey),
          lt: new Date(dateKeyToUtcDate(lastDayKey).getTime() + 86_400_000),
        },
      },
    }),
  ]);

  const monthWorkedMin = monthEntries.reduce(
    (sum, e) =>
      sum +
      computeWorked({
        clockInAt: e.clockInAt,
        clockOutAt: e.clockOutAt,
        breakMin: e.breakMin,
        autoDeductBreak: setting.autoDeductBreak,
        breakRule: { breakAfter6h: setting.breakAfter6h, breakAfter9h: setting.breakAfter9h },
        roundingMin: setting.roundingMin,
      }).workedMin,
    0,
  );

  const weekMin = assignments.reduce(
    (sum, a) => sum + Math.max(0, shiftSpanMinutes(a.startMinute, a.endMinute) - a.breakMin),
    0,
  );
  const todayKey = localDateKey(new Date(), tz);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ca của tôi"
        description="Lịch làm việc của bạn trong tuần."
        action={
          <Button asChild variant="outline">
            <Link href="/dashboard/absences">
              <CalendarOff className="h-4 w-4" /> Báo ốm / xin nghỉ
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Trạng thái</p>
            {openEntry ? (
              <p className="mt-1 flex items-center gap-2 font-semibold text-success">
                <Clock className="h-4 w-4" /> Đang trong ca từ{" "}
                {new Intl.DateTimeFormat("de-DE", {
                  timeZone: tz,
                  hour: "2-digit",
                  minute: "2-digit",
                }).format(openEntry.clockInAt)}
              </p>
            ) : (
              <p className="mt-1 font-semibold text-muted-foreground">Chưa vào ca</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Giờ đã xếp tuần này</p>
            <p className="mt-1 text-lg font-semibold tabular-nums">{formatDuration(weekMin)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Giờ công tháng này</p>
            <p className="mt-1 text-lg font-semibold tabular-nums">
              {formatDuration(monthWorkedMin)}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center justify-between">
        <Button asChild variant="outline" size="sm">
          <Link href={`/dashboard/my-schedule?week=${addDays(monday, -7)}`}>Tuần trước</Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href={`/dashboard/my-schedule?week=${addDays(monday, 7)}`}>Tuần sau</Link>
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {weekKeys.map((key, i) => {
          const dayShifts = assignments.filter((a) => utcDateToKey(a.date) === key);
          const off = absences.find(
            (a) => utcDateToKey(a.startDate) <= key && utcDateToKey(a.endDate) >= key,
          );
          return (
            <Card key={key} className={key === todayKey ? "border-primary" : undefined}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between text-sm">
                  <span>{WEEKDAY_LABELS_VI[i]}</span>
                  <span className="text-xs font-normal tabular-nums text-muted-foreground">
                    {key.split("-").reverse().slice(0, 2).join(".")}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {off && (
                  <Badge variant={off.status === "APPROVED" ? "destructive" : "warning"}>
                    {ABSENCE_LABELS[off.type] ?? "Nghỉ"}
                    {off.status === "REQUESTED" ? " (chờ duyệt)" : ""}
                  </Badge>
                )}
                {!off && dayShifts.length === 0 && (
                  <p className="text-sm text-muted-foreground">Không có ca</p>
                )}
                {dayShifts.map((a) => (
                  <div key={a.id} className="rounded-md bg-muted/60 px-2 py-1.5">
                    <p className="text-sm font-medium">{a.template?.name ?? "Ca"}</p>
                    <p className="text-xs tabular-nums text-muted-foreground">
                      {formatHhMm(a.startMinute)}–{formatHhMm(a.endMinute)}
                      {a.breakMin > 0 ? ` · nghỉ ${a.breakMin}′` : ""}
                    </p>
                    {a.department && (
                      <p className="text-xs text-muted-foreground">{a.department.name}</p>
                    )}
                    {a.note && <p className="mt-1 text-xs italic">{a.note}</p>}
                  </div>
                ))}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
