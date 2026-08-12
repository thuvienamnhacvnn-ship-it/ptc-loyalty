import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, Clock, MessageCircleOff, User } from "lucide-react";
import { db } from "@/lib/db";
import { requireBusinessContext } from "@/lib/tenant";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/dashboard/page-header";
import { AppointmentForm } from "./appointment-form";
import { setAppointmentStatus } from "./actions";

export const metadata: Metadata = { title: "Lịch hẹn" };

const statusVariant = {
  BOOKED: "warning",
  CONFIRMED: "default",
  DONE: "success",
  NO_SHOW: "destructive",
  CANCELLED: "secondary",
} as const;

const statusLabel = {
  BOOKED: "Đã đặt",
  CONFIRMED: "Đã xác nhận",
  DONE: "Đã tới",
  NO_SHOW: "Không tới",
  CANCELLED: "Đã huỷ",
} as const;

/** Khách hàng lưu firstName + lastName riêng, chỗ hiển thị cần một chuỗi. */
function fullName(c: { firstName: string; lastName: string | null }): string {
  return `${c.firstName} ${c.lastName ?? ""}`.trim();
}

/** "2026-08-15" theo múi giờ của quán, không phải của máy chủ. */
function todayInTimezone(timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone || "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function hhmm(d: Date, timezone: string): string {
  return new Intl.DateTimeFormat("de-DE", {
    timeZone: timezone || "Europe/Berlin",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export default async function AppointmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const ctx = await requireBusinessContext();
  const { date } = await searchParams;

  const business = await db.business.findUnique({
    where: { id: ctx.businessId },
    select: { timezone: true },
  });
  const tz = business?.timezone ?? "Europe/Berlin";

  const day = /^\d{4}-\d{2}-\d{2}$/.test(date ?? "") ? date! : todayInTimezone(tz);

  // Lấy rộng ±1 ngày rồi lọc theo ngày địa phương của quán — tránh sai lệch múi
  // giờ ở hai đầu ngày.
  const from = new Date(`${day}T00:00:00Z`);
  const windowStart = new Date(from.getTime() - 36 * 3600_000);
  const windowEnd = new Date(from.getTime() + 60 * 3600_000);

  const [rows, customers, staff] = await Promise.all([
    db.appointment.findMany({
      where: {
        businessId: ctx.businessId,
        startAt: { gte: windowStart, lte: windowEnd },
      },
      orderBy: { startAt: "asc" },
      include: {
        customer: {
          select: { id: true, firstName: true, lastName: true, phone: true, memberCode: true },
        },
        staff: { select: { user: { select: { name: true, email: true } } } },
      },
    }),
    db.customerProfile.findMany({
      where: { businessId: ctx.businessId },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      select: { id: true, firstName: true, lastName: true, phone: true, memberCode: true },
      take: 500,
    }),
    db.staffProfile.findMany({
      where: { businessId: ctx.businessId, isActive: true },
      select: { id: true, user: { select: { name: true, email: true } } },
    }),
  ]);

  const dayFmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const appointments = rows.filter((a) => dayFmt.format(a.startAt) === day);

  const shift = (delta: number) => {
    const d = new Date(`${day}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + delta);
    return d.toISOString().slice(0, 10);
  };

  const readableDay = new Intl.DateTimeFormat("vi-VN", {
    timeZone: "UTC",
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(`${day}T12:00:00Z`));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Lịch hẹn</h2>
          <p className="text-sm text-muted-foreground">
            Khách đã là thành viên sẽ tự nhận tin xác nhận và tin nhắc trước giờ
            hẹn qua WhatsApp của quán.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/dashboard/appointments?date=${shift(-1)}`}>← Hôm trước</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={`/dashboard/appointments?date=${todayInTimezone(tz)}`}>Hôm nay</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={`/dashboard/appointments?date=${shift(1)}`}>Hôm sau →</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <CalendarDays className="h-4 w-4 text-primary" />
            {readableDay}
            <span className="text-muted-foreground">· {appointments.length} lịch</span>
          </div>

          {appointments.length === 0 ? (
            <EmptyState
              title="Ngày này chưa có lịch hẹn"
              description="Dùng ô bên cạnh để đặt lịch cho khách."
            />
          ) : (
            appointments.map((a) => (
              <Card key={a.id}>
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 font-semibold">
                        <Clock className="h-4 w-4 text-primary" />
                        {hhmm(a.startAt, tz)}
                        <span className="text-sm font-normal text-muted-foreground">
                          · {a.durationMin} phút
                        </span>
                      </p>
                      <p className="mt-1 font-medium">{fullName(a.customer)}</p>
                      <p className="text-sm text-muted-foreground">
                        {a.customer.phone ?? "chưa có số"} · {a.customer.memberCode}
                      </p>
                      <p className="mt-1 text-sm">
                        {a.service ?? "—"}
                        <span className="text-muted-foreground">
                          {" · "}
                          <User className="mb-0.5 inline h-3 w-3" />{" "}
                          {a.staff?.user.name ?? "chưa phân công"}
                        </span>
                      </p>
                      {a.note && (
                        <p className="mt-1 text-sm text-muted-foreground">{a.note}</p>
                      )}
                      {!a.confirmSentAt && (
                        <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                          <MessageCircleOff className="h-3.5 w-3.5" />
                          Chưa gửi được tin xác nhận — kiểm tra kết nối WhatsApp
                          hoặc số điện thoại của khách.
                        </p>
                      )}
                    </div>
                    <Badge variant={statusVariant[a.status]}>{statusLabel[a.status]}</Badge>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {(["CONFIRMED", "DONE", "NO_SHOW", "CANCELLED"] as const)
                      .filter((s) => s !== a.status)
                      .map((s) => (
                        <form key={s} action={setAppointmentStatus}>
                          <input type="hidden" name="id" value={a.id} />
                          <input type="hidden" name="status" value={s} />
                          <Button size="sm" variant="ghost" type="submit">
                            {statusLabel[s]}
                          </Button>
                        </form>
                      ))}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        <Card className="h-fit">
          <CardContent className="pt-6">
            <h3 className="mb-4 font-semibold">Đặt lịch mới</h3>
            <AppointmentForm
              customers={customers.map((c) => ({
                id: c.id,
                name: fullName(c),
                phone: c.phone,
                memberCode: c.memberCode,
              }))}
              staff={staff.map((s) => ({
                id: s.id,
                name: s.user.name?.trim() || s.user.email,
              }))}
              defaultDate={day}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
