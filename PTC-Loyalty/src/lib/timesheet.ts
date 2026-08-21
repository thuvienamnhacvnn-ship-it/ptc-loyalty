import { db } from "@/lib/db";
import { getWorkTimeSetting } from "@/lib/worktime-setup";
import {
  checkCompliance,
  computeWorked,
  localDateKey,
  wageCents,
  type ComplianceIssue,
} from "@/lib/worktime";
import { dateKeyToUtcDate, utcDateToKey } from "@/lib/schedule";
import { shiftSpanMinutes } from "@/lib/worktime";

/**
 * Bảng công tháng: gộp mọi lần chấm công của một tháng theo từng nhân viên.
 * Dùng chung cho màn hình xem và cho file CSV gửi kế toán lương, nên hai nơi
 * không bao giờ ra hai con số khác nhau.
 */

export interface TimesheetDay {
  dateKey: string;
  workedMin: number;
  breakMin: number;
  lateMin: number;
  earlyLeaveMin: number;
  /** Ca có mà không ai quét, hoặc quét vào rồi quên quét ra. */
  hasProblem: boolean;
  issues: ComplianceIssue[];
}

export interface TimesheetRow {
  staffId: string;
  name: string;
  employeeNo: string | null;
  departmentName: string | null;
  workedMin: number;
  plannedMin: number;
  lateMin: number;
  lateCount: number;
  earlyLeaveMin: number;
  /** Số ca hệ thống phải tự đóng vì quên quét ra. */
  autoClosedCount: number;
  /** Số ngày đã xếp ca nhưng không có lần chấm công nào. */
  noShowCount: number;
  absenceDays: number;
  wageCents: number | null;
  issues: ComplianceIssue[];
  days: TimesheetDay[];
}

export interface TimesheetResult {
  monthKey: string; // "2026-08"
  firstDayKey: string;
  lastDayKey: string;
  rows: TimesheetRow[];
  totalWorkedMin: number;
  totalWageCents: number | null;
}

/** Ngày đầu và ngày cuối của tháng "YYYY-MM". */
export function monthBounds(monthKey: string): { firstDayKey: string; lastDayKey: string } {
  const [y, m] = monthKey.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  // Ngày 0 của tháng sau chính là ngày cuối tháng này, khỏi phải nhớ tháng nào 30 hay 31.
  const last = new Date(Date.UTC(y, m, 0));
  return {
    firstDayKey: first.toISOString().slice(0, 10),
    lastDayKey: last.toISOString().slice(0, 10),
  };
}

/** Tháng hiện tại theo lịch quán, dạng "YYYY-MM". */
export function currentMonthKey(timezone: string): string {
  return localDateKey(new Date(), timezone).slice(0, 7);
}

export async function buildTimesheet(
  businessId: string,
  monthKey: string,
  options: { includeWage: boolean },
): Promise<TimesheetResult> {
  const { firstDayKey, lastDayKey } = monthBounds(monthKey);
  const business = await db.business.findUnique({
    where: { id: businessId },
    select: { timezone: true },
  });
  const tz = business?.timezone || "Europe/Berlin";
  const setting = await getWorkTimeSetting(businessId);
  const breakRule = { breakAfter6h: setting.breakAfter6h, breakAfter9h: setting.breakAfter9h };

  // Lấy dư một ngày ở hai đầu: ca đêm cuối tháng trước kết thúc trong tháng này,
  // và ngược lại. Lọc lại theo ngày quét VÀO nên không đếm trùng.
  const rangeStart = dateKeyToUtcDate(firstDayKey);
  const rangeEnd = new Date(dateKeyToUtcDate(lastDayKey).getTime() + 2 * 86_400_000);

  const [staff, entries, assignments, absences] = await Promise.all([
    db.staffProfile.findMany({
      where: { businessId },
      select: {
        id: true,
        employeeNo: true,
        hourlyWageCents: true,
        user: { select: { name: true, email: true } },
        department: { select: { name: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    db.timeEntry.findMany({
      where: { businessId, clockInAt: { gte: rangeStart, lt: rangeEnd } },
      orderBy: { clockInAt: "asc" },
    }),
    db.shiftAssignment.findMany({
      where: {
        businessId,
        status: { not: "CANCELLED" },
        date: { gte: rangeStart, lte: dateKeyToUtcDate(lastDayKey) },
      },
      select: { staffId: true, date: true, startMinute: true, endMinute: true, breakMin: true },
    }),
    db.staffAbsence.findMany({
      where: {
        businessId,
        status: "APPROVED",
        endDate: { gte: rangeStart },
        startDate: { lte: dateKeyToUtcDate(lastDayKey) },
      },
      select: { staffId: true, startDate: true, endDate: true },
    }),
  ]);

  const rows: TimesheetRow[] = staff.map((s) => {
    const myEntries = entries.filter(
      (e) => e.staffId === s.id && localDateKey(e.clockInAt, tz) >= firstDayKey && localDateKey(e.clockInAt, tz) <= lastDayKey,
    );
    const myAssignments = assignments.filter((a) => a.staffId === s.id);

    const byDay = new Map<string, TimesheetDay>();
    let lastEnd: Date | null = null;

    for (const e of myEntries) {
      const dateKey = localDateKey(e.clockInAt, tz);
      const worked = computeWorked({
        clockInAt: e.clockInAt,
        clockOutAt: e.clockOutAt,
        breakMin: e.breakMin,
        autoDeductBreak: setting.autoDeductBreak,
        breakRule,
        roundingMin: setting.roundingMin,
      });

      const restBeforeMin =
        lastEnd && e.clockInAt > lastEnd
          ? Math.round((e.clockInAt.getTime() - lastEnd.getTime()) / 60_000)
          : null;

      const day = byDay.get(dateKey) ?? {
        dateKey,
        workedMin: 0,
        breakMin: 0,
        lateMin: 0,
        earlyLeaveMin: 0,
        hasProblem: false,
        issues: [],
      };
      day.workedMin += worked.workedMin;
      day.breakMin += worked.breakMin;
      day.lateMin += e.lateMin;
      day.earlyLeaveMin += e.earlyLeaveMin;
      // Ca chưa đóng hoặc bị máy tự đóng thì số giờ không đáng tin.
      if (e.autoClosed || !e.clockOutAt) day.hasProblem = true;
      day.issues.push(
        ...checkCompliance({
          workedMin: day.workedMin,
          breakMin: day.breakMin,
          breakRule,
          maxDailyHours: setting.maxDailyHours,
          restBeforeMin,
          minRestHours: setting.minRestHours,
        }),
      );
      byDay.set(dateKey, day);
      if (e.clockOutAt) lastEnd = e.clockOutAt;
    }

    const days = [...byDay.values()].sort((a, b) => a.dateKey.localeCompare(b.dateKey));
    const workedMin = days.reduce((sum, d) => sum + d.workedMin, 0);

    const plannedMin = myAssignments.reduce(
      (sum, a) => sum + Math.max(0, shiftSpanMinutes(a.startMinute, a.endMinute) - a.breakMin),
      0,
    );

    // Ngày có xếp ca mà không hề có lần chấm công nào.
    const punchedDays = new Set(days.map((d) => d.dateKey));
    const noShowCount = myAssignments.filter(
      (a) => !punchedDays.has(utcDateToKey(a.date)),
    ).length;

    const absenceDays = absences
      .filter((a) => a.staffId === s.id)
      .reduce((sum, a) => {
        const from = utcDateToKey(a.startDate) < firstDayKey ? firstDayKey : utcDateToKey(a.startDate);
        const to = utcDateToKey(a.endDate) > lastDayKey ? lastDayKey : utcDateToKey(a.endDate);
        const diff =
          (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000 + 1;
        return sum + Math.max(0, diff);
      }, 0);

    return {
      staffId: s.id,
      name: s.user.name ?? s.user.email,
      employeeNo: s.employeeNo,
      departmentName: s.department?.name ?? null,
      workedMin,
      plannedMin,
      lateMin: days.reduce((sum, d) => sum + d.lateMin, 0),
      lateCount: days.filter((d) => d.lateMin > 0).length,
      earlyLeaveMin: days.reduce((sum, d) => sum + d.earlyLeaveMin, 0),
      autoClosedCount: myEntries.filter((e) => e.autoClosed).length,
      noShowCount,
      absenceDays,
      wageCents: options.includeWage ? wageCents(workedMin, s.hourlyWageCents) : null,
      // Gộp cảnh báo trùng loại lại, tháng 30 ngày mà in 30 dòng "thiếu giờ nghỉ"
      // thì không ai đọc.
      issues: dedupeIssues(days.flatMap((d) => d.issues)),
      days,
    };
  });

  const totalWorkedMin = rows.reduce((sum, r) => sum + r.workedMin, 0);
  const wageRows = rows.filter((r) => r.wageCents != null);

  return {
    monthKey,
    firstDayKey,
    lastDayKey,
    rows,
    totalWorkedMin,
    totalWageCents: wageRows.length > 0 ? wageRows.reduce((s, r) => s + (r.wageCents ?? 0), 0) : null,
  };
}

function dedupeIssues(issues: ComplianceIssue[]): ComplianceIssue[] {
  const seen = new Set<string>();
  return issues.filter((i) => {
    if (seen.has(i.code)) return false;
    seen.add(i.code);
    return true;
  });
}
