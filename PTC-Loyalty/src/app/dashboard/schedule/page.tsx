import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight, Copy, Check } from "lucide-react";
import { db } from "@/lib/db";
import { requireBusinessContext } from "@/lib/tenant";
import { hasAtLeast } from "@/lib/rbac";
import { ensureScheduleDefaults, usesDepartments } from "@/lib/worktime-setup";
import { formatHhMm, localDateKey, shiftSpanMinutes } from "@/lib/worktime";
import { addDays, dateKeyToUtcDate, mondayOf, utcDateToKey, weekDateKeys } from "@/lib/schedule";
import { PageHeader, EmptyState } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScheduleBoard } from "./schedule-board";
import { ScheduleSettings } from "./schedule-settings";
import { confirmWeek, copyPreviousWeek } from "./actions";
import { staffDisplayName, workerWhere } from "@/lib/staff-name";

export const metadata: Metadata = { title: "Xếp ca" };
export const dynamic = "force-dynamic";

const ABSENCE_LABELS: Record<string, string> = {
  SICK: "Báo ốm",
  VACATION: "Nghỉ phép",
  UNPAID: "Nghỉ không lương",
  TRAINING: "Đào tạo",
  OTHER: "Nghỉ",
};

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const ctx = await requireBusinessContext();
  const canManage = hasAtLeast(ctx.role, "BUSINESS_MANAGER");

  const business = await db.business.findUnique({
    where: { id: ctx.businessId },
    select: { timezone: true, type: true },
  });
  const tz = business?.timezone || "Europe/Berlin";

  // Lần đầu quán mở trang này thì dựng sẵn ca sáng/ca chiều và bộ phận, để
  // người dùng có cái bấm ngay thay vì nhìn một bảng trống.
  if (canManage) await ensureScheduleDefaults(ctx.businessId, business?.type ?? "other");

  const params = await searchParams;
  const requested = /^\d{4}-\d{2}-\d{2}$/.test(params.week ?? "")
    ? (params.week as string)
    : localDateKey(new Date(), tz);
  const monday = mondayOf(requested);
  const weekKeys = weekDateKeys(monday);
  const sunday = weekKeys[6];

  const [staff, assignments, absences, templates, departments] = await Promise.all([
    db.staffProfile.findMany({
      // Chủ quán không phải nhân viên nên không xuất hiện trên bảng xếp ca.
      where: { businessId: ctx.businessId, isActive: true, ...workerWhere },
      select: {
        id: true,
        weeklyHours: true,
        name: true,
        user: { select: { name: true, email: true } },
        department: { select: { name: true, sortOrder: true } },
      },
      orderBy: [{ createdAt: "asc" }],
    }),
    db.shiftAssignment.findMany({
      where: {
        businessId: ctx.businessId,
        status: { not: "CANCELLED" },
        date: { gte: dateKeyToUtcDate(monday), lte: dateKeyToUtcDate(sunday) },
      },
      include: {
        template: { select: { name: true, colorHex: true } },
        department: { select: { name: true, colorHex: true } },
      },
    }),
    db.staffAbsence.findMany({
      where: {
        businessId: ctx.businessId,
        status: "APPROVED",
        // Kỳ nghỉ chỉ cần CHẠM vào tuần này là phải hiện, không cần nằm trọn trong tuần.
        endDate: { gte: dateKeyToUtcDate(monday) },
        startDate: { lte: dateKeyToUtcDate(sunday) },
      },
      select: { staffId: true, type: true, startDate: true, endDate: true },
    }),
    db.shiftTemplate.findMany({
      where: { businessId: ctx.businessId, isActive: true },
      orderBy: { sortOrder: "asc" },
      include: { department: { select: { name: true } } },
    }),
    db.department.findMany({
      where: { businessId: ctx.businessId, isActive: true },
      orderBy: { sortOrder: "asc" },
    }),
  ]);

  // Trải kỳ nghỉ ra từng ngày để bảng tô được đúng ô — DB lưu khoảng, còn bảng
  // vẽ theo ô ngày.
  const absenceCells = absences.flatMap((a) => {
    const from = utcDateToKey(a.startDate);
    const to = utcDateToKey(a.endDate);
    return weekKeys
      .filter((k) => k >= from && k <= to)
      .map((k) => ({
        staffId: a.staffId,
        dateKey: k,
        label: ABSENCE_LABELS[a.type] ?? "Nghỉ",
      }));
  });

  const weekLabel = `${monday.split("-").reverse().slice(0, 2).join(".")} – ${sunday
    .split("-")
    .reverse()
    .slice(0, 2)
    .join(".")}.${sunday.slice(0, 4)}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Xếp ca"
        description="Lịch làm việc theo tuần. Người đang nghỉ ốm sẽ không xếp ca được."
        action={
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href={`/dashboard/schedule?week=${addDays(monday, -7)}`}>
                <ChevronLeft className="h-4 w-4" />
              </Link>
            </Button>
            <span className="min-w-[150px] text-center text-sm font-medium tabular-nums">
              {weekLabel}
            </span>
            <Button asChild variant="outline" size="sm">
              <Link href={`/dashboard/schedule?week=${addDays(monday, 7)}`}>
                <ChevronRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        }
      />

      {canManage && (
        <div className="flex flex-wrap gap-2">
          <form action={copyPreviousWeek}>
            <input type="hidden" name="monday" value={monday} />
            <Button type="submit" variant="outline" size="sm">
              <Copy className="h-4 w-4" /> Chép lịch tuần trước
            </Button>
          </form>
          <form action={confirmWeek}>
            <input type="hidden" name="monday" value={monday} />
            <Button type="submit" variant="outline" size="sm">
              <Check className="h-4 w-4" /> Chốt cả tuần
            </Button>
          </form>
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard/absences">
              <CalendarDays className="h-4 w-4" /> Nghỉ phép &amp; báo ốm
            </Link>
          </Button>
        </div>
      )}

      {staff.length === 0 ? (
        <EmptyState
          title="Chưa có nhân viên"
          description="Thêm nhân viên trước rồi mới xếp được ca."
          action={
            <Button asChild>
              <Link href="/dashboard/staff">Thêm nhân viên</Link>
            </Button>
          }
        />
      ) : (
        <ScheduleBoard
          weekKeys={weekKeys}
          canManage={canManage}
          staff={staff.map((s) => ({
            id: s.id,
            name: staffDisplayName(s),
            departmentName: s.department?.name ?? null,
            weeklyHours: s.weeklyHours,
          }))}
          shifts={assignments.map((a) => ({
            id: a.id,
            staffId: a.staffId,
            dateKey: utcDateToKey(a.date),
            label: a.template?.name ?? a.department?.name ?? "Ca",
            timeLabel: `${formatHhMm(a.startMinute)}–${formatHhMm(a.endMinute)}`,
            colorHex: a.department?.colorHex ?? a.template?.colorHex ?? "#145DFF",
            departmentName: a.department?.name ?? null,
            spanMin: Math.max(0, shiftSpanMinutes(a.startMinute, a.endMinute) - a.breakMin),
            confirmed: a.status === "CONFIRMED",
          }))}
          absences={absenceCells}
          templates={templates.map((t) => ({
            id: t.id,
            name: t.name,
            timeLabel: `${formatHhMm(t.startMinute)}–${formatHhMm(t.endMinute)}`,
            breakMin: t.breakMin,
          }))}
          departments={departments.map((d) => ({ id: d.id, name: d.name }))}
        />
      )}

      {canManage && (
        <ScheduleSettings
          templates={templates.map((t) => ({
            id: t.id,
            name: t.name,
            timeLabel: `${formatHhMm(t.startMinute)}–${formatHhMm(t.endMinute)}`,
            breakMin: t.breakMin,
            departmentName: t.department?.name ?? null,
          }))}
          departments={departments.map((d) => ({
            id: d.id,
            name: d.name,
            colorHex: d.colorHex,
          }))}
          showDepartments={usesDepartments(business?.type ?? "other") || departments.length > 0}
        />
      )}

      {staff.length > 0 && absenceCells.length === 0 && (
        <Card>
          <CardContent className="p-4 text-sm text-muted-foreground">
            Tuần này chưa có ai báo nghỉ. Khi nhân viên báo ốm và được duyệt, ô của người đó chuyển
            thành ô đỏ và hệ thống chặn không cho xếp ca vào những ngày đó.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
