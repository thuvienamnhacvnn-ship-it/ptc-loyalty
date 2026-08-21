/**
 * Luật xếp ca. Phần thuần (tính khoảng thời gian, dò trùng, dò vướng ngày
 * nghỉ) tách hẳn khỏi phần chạm DB để test được mà không cần Postgres.
 */

import { MINUTES_PER_DAY, shiftSpanMinutes } from "@/lib/worktime";

/** Một ca rút gọn về đúng thứ cần để so trùng. */
export interface ShiftWindow {
  /** Ngày làm việc, "YYYY-MM-DD" theo lịch quán. */
  dateKey: string;
  startMinute: number;
  endMinute: number;
}

/** Khoảng thời gian tuyệt đối tính bằng phút kể từ mốc 1970-01-01 giờ quán. */
export interface AbsoluteRange {
  start: number;
  end: number;
}

const MS_PER_DAY = 86_400_000;

/** "2026-08-24" → số ngày kể từ 1970-01-01. Chuỗi sai trả NaN. */
export function dayIndex(dateKey: string): number {
  const ms = Date.parse(`${dateKey}T00:00:00Z`);
  return Number.isNaN(ms) ? NaN : Math.floor(ms / MS_PER_DAY);
}

/**
 * Trải một ca thành khoảng phút tuyệt đối.
 *
 * Đây là chỗ ca qua đêm được "duỗi thẳng": ca 18:00–02:00 ngày 24 thành
 * [ngày24 18:00, ngày25 02:00], nhờ vậy so trùng với ca sáng ngày 25 mới ra
 * đúng. So bằng startMinute/endMinute trần thì ca đêm luôn trông như không
 * chạm ai cả.
 */
export function toAbsoluteRange(shift: ShiftWindow): AbsoluteRange {
  const base = dayIndex(shift.dateKey) * MINUTES_PER_DAY;
  const start = base + shift.startMinute;
  return { start, end: start + shiftSpanMinutes(shift.startMinute, shift.endMinute) };
}

/** Hai ca có đè lên nhau không. Chạm đầu đuôi (16:00 và 16:00) KHÔNG tính đè. */
export function shiftsOverlap(a: ShiftWindow, b: ShiftWindow): boolean {
  const ra = toAbsoluteRange(a);
  const rb = toAbsoluteRange(b);
  return ra.start < rb.end && rb.start < ra.end;
}

/** Khoảng nghỉ giữa hai ca, tính bằng phút. Âm nghĩa là hai ca đè nhau. */
export function restGapMinutes(previous: ShiftWindow, next: ShiftWindow): number {
  return toAbsoluteRange(next).start - toAbsoluteRange(previous).end;
}

export interface AbsenceWindow {
  startDateKey: string;
  endDateKey: string;
}

/**
 * Ngày `dateKey` có rơi vào kỳ nghỉ nào không. Bao gồm cả ngày đầu lẫn ngày
 * cuối — nhân viên báo ốm "24 đến 24" là nghỉ trọn ngày 24, không phải 0 ngày.
 */
export function findBlockingAbsence<T extends AbsenceWindow>(
  dateKey: string,
  absences: T[],
): T | null {
  const d = dayIndex(dateKey);
  if (Number.isNaN(d)) return null;
  return (
    absences.find((a) => {
      const from = dayIndex(a.startDateKey);
      const to = dayIndex(a.endDateKey);
      return !Number.isNaN(from) && !Number.isNaN(to) && d >= from && d <= to;
    }) ?? null
  );
}

/** Số ngày của một kỳ nghỉ, tính cả hai đầu. Ngược ngày trả 0. */
export function absenceDayCount(absence: AbsenceWindow): number {
  const from = dayIndex(absence.startDateKey);
  const to = dayIndex(absence.endDateKey);
  if (Number.isNaN(from) || Number.isNaN(to) || to < from) return 0;
  return to - from + 1;
}

/** Danh sách ngày "YYYY-MM-DD" của một tuần bắt đầu từ thứ Hai. */
export function weekDateKeys(mondayKey: string): string[] {
  const base = dayIndex(mondayKey);
  if (Number.isNaN(base)) return [];
  return Array.from({ length: 7 }, (_, i) =>
    new Date((base + i) * MS_PER_DAY).toISOString().slice(0, 10),
  );
}

/**
 * Thứ Hai của tuần chứa `dateKey`. Tuần ở Đức bắt đầu từ thứ Hai, không phải
 * Chủ nhật như mặc định của JavaScript.
 */
export function mondayOf(dateKey: string): string {
  const d = dayIndex(dateKey);
  if (Number.isNaN(d)) return dateKey;
  // 1970-01-01 là thứ Năm, nên +3 mới đưa mốc 0 về thứ Hai.
  const weekday = (((d + 3) % 7) + 7) % 7;
  return new Date((d - weekday) * MS_PER_DAY).toISOString().slice(0, 10);
}

/** Cộng thêm số ngày vào một ngày dạng chuỗi. */
export function addDays(dateKey: string, days: number): string {
  const d = dayIndex(dateKey);
  if (Number.isNaN(d)) return dateKey;
  return new Date((d + days) * MS_PER_DAY).toISOString().slice(0, 10);
}

/**
 * `Date` để cất vào cột `@db.Date` của Prisma.
 *
 * Phải là nửa đêm UTC. Dùng `new Date("2026-08-24")` thì đúng, nhưng
 * `new Date(2026, 7, 24)` thì sai — cái sau lấy múi giờ máy chủ, và ở múi giờ
 * dương thì nó lùi về ngày 23 khi quy sang UTC.
 */
export function dateKeyToUtcDate(dateKey: string): Date {
  return new Date(`${dateKey}T00:00:00.000Z`);
}

/** Chiều ngược lại: cột `@db.Date` → "YYYY-MM-DD". */
export function utcDateToKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export const WEEKDAY_LABELS_VI = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "CN"];
