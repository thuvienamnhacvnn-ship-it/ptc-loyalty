/**
 * Toán giờ công. Toàn bộ file này là hàm THUẦN — không đụng DB, không đọc giờ
 * hệ thống — nên tính được bằng test thay vì phải dựng cả một ngày làm việc.
 *
 * Hai hệ quy chiếu song song, nhầm là sai cả bảng lương:
 *  - KẾ HOẠCH đo bằng "phút từ nửa đêm" theo giờ quán (08:00 → 480).
 *  - THỰC TẾ đo bằng Date mốc UTC.
 * Muốn so hai bên phải quy về cùng một hệ, xem `minutesFromMidnightInTz`.
 */

export const MINUTES_PER_DAY = 1440;

/** "08:30" → 510. Trả về null nếu chuỗi không phải giờ hợp lệ. */
export function parseHhMm(value: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** 510 → "08:30". Phút vượt quá một ngày được cuộn lại (ca qua đêm). */
export function formatHhMm(minute: number): string {
  const m = ((minute % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/**
 * Độ dài ca tính bằng phút, xử lý luôn ca qua đêm.
 *
 * Ca bếp hay chạy 18:00–02:00: endMinute (120) NHỎ HƠN startMinute (1080).
 * Trừ thẳng ra âm 960 phút, nên phải cộng bù một ngày. `end === start` cũng là
 * ca qua đêm tròn 24 tiếng chứ không phải ca dài 0 phút — nhưng ca 24 tiếng thì
 * vô lý, nên chỗ nhập liệu chặn trước, ở đây chỉ lo tính đúng.
 */
export function shiftSpanMinutes(startMinute: number, endMinute: number): number {
  const raw = endMinute - startMinute;
  return raw > 0 ? raw : raw + MINUTES_PER_DAY;
}

/** Ca có vắt qua nửa đêm không. */
export function isOvernight(startMinute: number, endMinute: number): boolean {
  return endMinute <= startMinute;
}

export interface BreakRule {
  /** Trên 6 tiếng phải nghỉ ngần này phút (ArbZG §4 → 30). */
  breakAfter6h: number;
  /** Trên 9 tiếng phải nghỉ ngần này phút (→ 45). */
  breakAfter9h: number;
}

/**
 * Giờ nghỉ TỐI THIỂU theo luật cho một ca dài `workedMin` phút.
 *
 * Luật Đức đếm theo giờ LÀM VIỆC (đã trừ nghỉ), nhưng ở đây nhận vào tổng thời
 * gian có mặt cho gọn — sai lệch chỉ xảy ra sát đúng mốc 6 và 9 tiếng và luôn
 * lệch về phía nghỉ nhiều hơn, tức là có lợi cho nhân viên. Đổi cách đếm thì
 * phải sửa cả test đi kèm.
 */
export function legalBreakMinutes(workedMin: number, rule: BreakRule): number {
  if (workedMin > 9 * 60) return rule.breakAfter9h;
  if (workedMin > 6 * 60) return rule.breakAfter6h;
  return 0;
}

/** Làm tròn số phút theo bội số cho trước. 0 hoặc âm = không làm tròn. */
export function roundMinutes(minutes: number, step: number): number {
  if (!step || step <= 0) return minutes;
  return Math.round(minutes / step) * step;
}

export interface WorkedInput {
  clockInAt: Date;
  clockOutAt: Date | null;
  /** Nghỉ do nhân viên/quản lý ghi nhận. */
  breakMin: number;
  /** Tự áp giờ nghỉ theo luật khi số đã ghi còn thiếu. */
  autoDeductBreak: boolean;
  breakRule: BreakRule;
  /** Làm tròn kết quả cuối theo bội số phút này. */
  roundingMin: number;
}

export interface WorkedResult {
  /** Tổng thời gian có mặt, chưa trừ nghỉ. */
  presentMin: number;
  /** Số phút nghỉ thực sự được trừ. */
  breakMin: number;
  /** Giờ công tính lương = có mặt − nghỉ, đã làm tròn, không bao giờ âm. */
  workedMin: number;
}

/**
 * Giờ công của MỘT lần chấm công.
 * Ca chưa quét ra (`clockOutAt` null) trả về 0 — đang làm thì chưa có giờ công.
 */
export function computeWorked(input: WorkedInput): WorkedResult {
  if (!input.clockOutAt) {
    return { presentMin: 0, breakMin: 0, workedMin: 0 };
  }
  const presentMin = Math.max(
    0,
    Math.round((input.clockOutAt.getTime() - input.clockInAt.getTime()) / 60_000),
  );

  // Lấy số lớn hơn giữa "nghỉ đã ghi" và "nghỉ luật bắt buộc". Nhân viên quên
  // bấm nghỉ không có nghĩa là quán được tính công cho cả giờ nghỉ đó.
  let breakMin = Math.max(0, input.breakMin);
  if (input.autoDeductBreak) {
    breakMin = Math.max(breakMin, legalBreakMinutes(presentMin, input.breakRule));
  }

  const workedMin = Math.max(0, roundMinutes(presentMin - breakMin, input.roundingMin));
  return { presentMin, breakMin, workedMin };
}

/**
 * Số phút từ nửa đêm của một mốc UTC, đọc theo múi giờ của quán.
 *
 * `Intl` là đường duy nhất đúng ở đây: server chạy UTC, quán ở Berlin, và
 * Berlin đổi giờ hai lần một năm. Tự cộng offset cứng là sai đúng vào tuần
 * chuyển mùa — mà đó lại là tuần bảng công bị soi kỹ nhất.
 */
export function minutesFromMidnightInTz(at: Date, timezone: string): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone || "Europe/Berlin",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(at);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  // Intl trả 24 cho nửa đêm ở một số môi trường, quy về 0 cho nhất quán.
  return (hour % 24) * 60 + minute;
}

/** Ngày theo lịch quán dưới dạng "YYYY-MM-DD". */
export function localDateKey(at: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone || "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(at);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export interface PunctualityInput {
  /** Giờ quét, đã quy về phút từ nửa đêm theo giờ quán. */
  actualMinute: number;
  /** Giờ ca theo kế hoạch. */
  plannedMinute: number;
  /** Lệch trong khoảng này thì coi như đúng giờ. */
  toleranceMin: number;
}

/**
 * Số phút đi muộn. Quét sớm trả 0 chứ không trả số âm — "đến sớm 10 phút"
 * không phải là "âm 10 phút muộn", và gộp hai thứ vào một số làm bảng công
 * tự bù trừ lẫn nhau.
 */
export function lateMinutes(input: PunctualityInput): number {
  const diff = wrapMinuteDiff(input.actualMinute, input.plannedMinute);
  return diff > input.toleranceMin ? diff : 0;
}

/** Số phút về sớm. Ở lại muộn trả 0 (làm thêm giờ tính riêng). */
export function earlyLeaveMinutes(input: PunctualityInput): number {
  const diff = wrapMinuteDiff(input.plannedMinute, input.actualMinute);
  return diff > input.toleranceMin ? diff : 0;
}

/**
 * Hiệu `a − b` trên vòng tròn 24 tiếng, kéo về khoảng (−720, +720].
 *
 * Cần vì ca đêm: quét ra lúc 00:10 (10 phút) so với giờ kết thúc 23:55 (1435)
 * ra −1425 phút nếu trừ thẳng, tức "về sớm 23 tiếng". Kết quả đúng là muộn 15
 * phút.
 */
function wrapMinuteDiff(a: number, b: number): number {
  let diff = (a - b) % MINUTES_PER_DAY;
  if (diff > MINUTES_PER_DAY / 2) diff -= MINUTES_PER_DAY;
  if (diff <= -MINUTES_PER_DAY / 2) diff += MINUTES_PER_DAY;
  return diff;
}

export interface ComplianceInput {
  workedMin: number;
  breakMin: number;
  breakRule: BreakRule;
  maxDailyHours: number;
  /** Khoảng nghỉ tới ca liền trước, tính bằng phút. null = không có ca trước. */
  restBeforeMin: number | null;
  minRestHours: number;
}

export type ComplianceCode =
  | "OVER_DAILY_LIMIT"
  | "BREAK_TOO_SHORT"
  | "REST_TOO_SHORT";

export interface ComplianceIssue {
  code: ComplianceCode;
  message: string;
}

/**
 * Soi một ngày công theo Arbeitszeitgesetz. Trả về CẢNH BÁO chứ không chặn:
 * quán vẫn phải trả công cho giờ đã làm, việc của phần mềm là để chủ quán nhìn
 * thấy chỗ sai mà sửa lịch, không phải giấu giờ đi.
 */
export function checkCompliance(input: ComplianceInput): ComplianceIssue[] {
  const issues: ComplianceIssue[] = [];

  if (input.workedMin > input.maxDailyHours * 60) {
    issues.push({
      code: "OVER_DAILY_LIMIT",
      message: `Làm ${formatDuration(input.workedMin)} trong một ngày, vượt trần ${input.maxDailyHours} tiếng (ArbZG §3).`,
    });
  }

  const required = legalBreakMinutes(input.workedMin + input.breakMin, input.breakRule);
  if (input.breakMin < required) {
    issues.push({
      code: "BREAK_TOO_SHORT",
      message: `Nghỉ ${input.breakMin} phút, luật đòi tối thiểu ${required} phút (ArbZG §4).`,
    });
  }

  if (input.restBeforeMin !== null && input.restBeforeMin < input.minRestHours * 60) {
    issues.push({
      code: "REST_TOO_SHORT",
      message: `Chỉ nghỉ ${formatDuration(input.restBeforeMin)} kể từ ca trước, cần ${input.minRestHours} tiếng (ArbZG §5).`,
    });
  }

  return issues;
}

/** 505 phút → "8h25". Dùng chung cho bảng công và màn hình chấm công. */
export function formatDuration(minutes: number): string {
  const sign = minutes < 0 ? "-" : "";
  const abs = Math.abs(Math.round(minutes));
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return m === 0 ? `${sign}${h}h` : `${sign}${h}h${String(m).padStart(2, "0")}`;
}

/** Giờ công quy ra tiền lương, tính bằng cent. */
export function wageCents(workedMin: number, hourlyWageCents: number | null): number | null {
  if (hourlyWageCents == null) return null;
  return Math.round((workedMin / 60) * hourlyWageCents);
}
