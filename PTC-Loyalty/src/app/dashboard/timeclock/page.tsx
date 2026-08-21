import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, Clock, LogIn, UserX } from "lucide-react";
import { db } from "@/lib/db";
import { requireBusinessContext } from "@/lib/tenant";
import { getWorkTimeSetting } from "@/lib/worktime-setup";
import {
  computeWorked,
  formatDuration,
  formatHhMm,
  localDateKey,
} from "@/lib/worktime";
import { addDays, dateKeyToUtcDate } from "@/lib/schedule";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { KioskClient } from "./kiosk-client";

export const metadata: Metadata = { title: "Chấm công" };

// Trang đọc "ai đang trong ca ngay lúc này" nên không được cache.
export const dynamic = "force-dynamic";

export default async function TimeclockPage() {
  const ctx = await requireBusinessContext();

  const business = await db.business.findUnique({
    where: { id: ctx.businessId },
    select: { timezone: true },
  });
  const tz = business?.timezone || "Europe/Berlin";
  const setting = await getWorkTimeSetting(ctx.businessId);
  const todayKey = localDateKey(new Date(), tz);

  const [entries, assignments, staffCount] = await Promise.all([
    // Lấy từ hôm qua để ca đêm bắt đầu tối qua vẫn hiện là "đang trong ca".
    db.timeEntry.findMany({
      where: {
        businessId: ctx.businessId,
        clockInAt: { gte: dateKeyToUtcDate(addDays(todayKey, -1)) },
      },
      orderBy: { clockInAt: "desc" },
      include: {
        staff: { select: { id: true, user: { select: { name: true, email: true } } } },
        department: { select: { name: true, colorHex: true } },
        assignment: { include: { template: { select: { name: true } } } },
      },
    }),
    db.shiftAssignment.findMany({
      where: {
        businessId: ctx.businessId,
        date: dateKeyToUtcDate(todayKey),
        status: { not: "CANCELLED" },
      },
      include: {
        staff: { select: { id: true, user: { select: { name: true, email: true } } } },
        template: { select: { name: true } },
      },
      orderBy: { startMinute: "asc" },
    }),
    db.staffProfile.count({ where: { businessId: ctx.businessId, isActive: true } }),
  ]);

  const openEntries = entries.filter((e) => !e.clockOutAt);
  const closedToday = entries.filter(
    (e) => e.clockOutAt && localDateKey(e.clockInAt, tz) === todayKey,
  );
  const onDutyIds = new Set(openEntries.map((e) => e.staffId));
  const punchedIds = new Set(entries.map((e) => e.staffId));

  // Đã xếp ca hôm nay mà chưa hề quét lần nào — đây là danh sách quán cần nhìn
  // vào lúc mở cửa, không phải danh sách người đang làm.
  const missing = assignments.filter((a) => !punchedIds.has(a.staffId));

  const workedTodayMin = closedToday.reduce(
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Chấm công"
        description="Nhân viên quét thẻ để vào ca và tan ca. Để màn hình này mở trên máy ở cửa nhân viên."
        action={
          <Button asChild variant="outline">
            <Link href="/dashboard/staff">In thẻ nhân viên</Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile
          icon={<LogIn className="h-4 w-4" />}
          label="Đang trong ca"
          value={`${openEntries.length}/${staffCount}`}
        />
        <StatTile
          icon={<Clock className="h-4 w-4" />}
          label="Giờ công hôm nay"
          value={formatDuration(workedTodayMin)}
        />
        <StatTile
          icon={<UserX className="h-4 w-4" />}
          label="Có ca nhưng chưa tới"
          value={String(missing.length)}
          tone={missing.length > 0 ? "warning" : "default"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <KioskClient />

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Đang trong ca</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {openEntries.length === 0 && (
                <p className="text-sm text-muted-foreground">Chưa có ai quét vào.</p>
              )}
              {openEntries.map((e) => (
                <div key={e.id} className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {e.staff.user.name ?? e.staff.user.email}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Vào lúc{" "}
                      {new Intl.DateTimeFormat("de-DE", {
                        timeZone: tz,
                        hour: "2-digit",
                        minute: "2-digit",
                      }).format(e.clockInAt)}
                      {e.department ? ` · ${e.department.name}` : ""}
                    </p>
                  </div>
                  {e.lateMin > 0 ? (
                    <Badge variant="warning">Muộn {e.lateMin}′</Badge>
                  ) : (
                    <Badge variant="success">Đúng giờ</Badge>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          {missing.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <AlertTriangle className="h-4 w-4 text-warning" />
                  Có ca nhưng chưa quét
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {missing.map((a) => (
                  <div key={a.id} className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm">
                      {a.staff.user.name ?? a.staff.user.email}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {a.template?.name ?? "Ca"} {formatHhMm(a.startMinute)}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Đã tan ca hôm nay</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {closedToday.length === 0 && (
                <p className="text-sm text-muted-foreground">Chưa có ai tan ca.</p>
              )}
              {closedToday.map((e) => {
                const worked = computeWorked({
                  clockInAt: e.clockInAt,
                  clockOutAt: e.clockOutAt,
                  breakMin: e.breakMin,
                  autoDeductBreak: setting.autoDeductBreak,
                  breakRule: {
                    breakAfter6h: setting.breakAfter6h,
                    breakAfter9h: setting.breakAfter9h,
                  },
                  roundingMin: setting.roundingMin,
                });
                return (
                  <div key={e.id} className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm">
                      {e.staff.user.name ?? e.staff.user.email}
                    </span>
                    <span className="flex items-center gap-2 text-xs text-muted-foreground">
                      {e.autoClosed && <Badge variant="destructive">Quên quét ra</Badge>}
                      {formatDuration(worked.workedMin)}
                    </span>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {onDutyIds.size > 0 && (
            <p className="text-xs text-muted-foreground">
              Quét lại trong vòng {setting.scanCooldownSec} giây bị bỏ qua để tránh bấm nhầm hai lần.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function StatTile({
  icon,
  label,
  value,
  tone = "default",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone?: "default" | "warning";
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <span
          className={`flex h-9 w-9 items-center justify-center rounded-lg ${
            tone === "warning" ? "bg-warning/15 text-warning" : "bg-primary/10 text-primary"
          }`}
        >
          {icon}
        </span>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-lg font-semibold tabular-nums">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
