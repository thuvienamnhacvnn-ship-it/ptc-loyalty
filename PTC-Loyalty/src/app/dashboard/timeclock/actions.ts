"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireBusinessContext } from "@/lib/tenant";
import { hasAtLeast } from "@/lib/rbac";
import { verifyStaffQrToken } from "@/lib/staff-qr";
import { getWorkTimeSetting } from "@/lib/worktime-setup";
import {
  computeWorked,
  earlyLeaveMinutes,
  formatDuration,
  lateMinutes,
  localDateKey,
  minutesFromMidnightInTz,
} from "@/lib/worktime";
import { addDays, dateKeyToUtcDate, dayIndex, toAbsoluteRange, utcDateToKey } from "@/lib/schedule";
import { MINUTES_PER_DAY } from "@/lib/worktime";
import { staffDisplayName, staffNameSelect } from "@/lib/staff-name";

export type PunchAction = "IN" | "OUT";

export interface PunchOk {
  ok: true;
  action: PunchAction;
  staffName: string;
  departmentName: string | null;
  /** Giờ quét, đã định dạng theo múi giờ quán. */
  atLabel: string;
  /** Tên ca đã xếp mà lần quét này khớp vào. */
  shiftLabel: string | null;
  lateMin: number;
  earlyLeaveMin: number;
  /** Chỉ có khi quét ra: tổng giờ công của ca vừa xong. */
  workedLabel: string | null;
  /** Nhắc nhở mềm — không chặn việc chấm công. */
  notes: string[];
}

export type PunchResult = PunchOk | { ok: false; error: string };

/** Giờ hiển thị trên máy chấm công, theo múi giờ quán chứ không theo máy chủ. */
function timeLabel(at: Date, timezone: string): string {
  return new Intl.DateTimeFormat("de-DE", {
    timeZone: timezone || "Europe/Berlin",
    hour: "2-digit",
    minute: "2-digit",
  }).format(at);
}

/**
 * Quét thẻ nhân viên: lần quét đầu là VÀO, lần sau là RA. Máy chấm công không
 * hỏi "bạn muốn vào hay ra" — người đứng trước máy đang vội, và một nút bấm sai
 * đẻ ra một ca 14 tiếng phải sửa tay.
 */
export async function punchByToken(token: string): Promise<PunchResult> {
  const ctx = await requireBusinessContext();

  const verified = verifyStaffQrToken(token);
  if (!verified.ok) {
    const map: Record<string, string> = {
      bad_signature: "Thẻ không hợp lệ.",
      malformed: "Không đọc được thẻ.",
      wrong_kind: "Đây là thẻ khách hàng, không phải thẻ nhân viên.",
    };
    return { ok: false, error: map[verified.reason] };
  }

  // Thẻ của quán khác thì coi như không tồn tại — không hé lộ rằng nó có thật.
  if (verified.payload.b !== ctx.businessId) {
    return { ok: false, error: "Thẻ này không thuộc quán của bạn." };
  }

  const staff = await db.staffProfile.findFirst({
    where: { id: verified.payload.s, businessId: ctx.businessId },
    select: {
      id: true,
      qrSecret: true,
      isActive: true,
      branchId: true,
      departmentId: true,
      ...staffNameSelect,
      department: { select: { name: true } },
    },
  });
  if (!staff) return { ok: false, error: "Không tìm thấy nhân viên." };
  // So bằng chuỗi là đủ: secret không phải mật khẩu, nó chỉ là số thẻ, và kẻ
  // tấn công không có chữ ký hợp lệ thì không tới được bước này.
  if (staff.qrSecret !== verified.payload.n) {
    return { ok: false, error: "Thẻ đã bị thu hồi. Xin thẻ mới từ quản lý." };
  }
  if (!staff.isActive) return { ok: false, error: "Tài khoản nhân viên đang bị khoá." };

  const business = await db.business.findUnique({
    where: { id: ctx.businessId },
    select: { timezone: true },
  });
  const tz = business?.timezone || "Europe/Berlin";
  const setting = await getWorkTimeSetting(ctx.businessId);

  const now = new Date();
  const staffName = staffDisplayName(staff);

  const open = await db.timeEntry.findFirst({
    where: { staffId: staff.id, businessId: ctx.businessId, clockOutAt: null },
    orderBy: { clockInAt: "desc" },
    include: { assignment: { include: { template: { select: { name: true } } } } },
  });

  // Chặn quét lặp. Bếp đông người, thẻ hay bị quét hai lần liên tiếp; không có
  // cửa này thì lần thứ hai đóng luôn ca vừa mở, ra một ca dài 3 giây.
  const cooldownMs = setting.scanCooldownSec * 1000;
  if (open && now.getTime() - open.clockInAt.getTime() < cooldownMs) {
    return {
      ok: false,
      error: `${staffName} vừa quét vào lúc ${timeLabel(open.clockInAt, tz)}. Đợi một chút rồi quét lại.`,
    };
  }
  if (!open) {
    const lastClosed = await db.timeEntry.findFirst({
      where: { staffId: staff.id, businessId: ctx.businessId, clockOutAt: { not: null } },
      orderBy: { clockOutAt: "desc" },
      select: { clockOutAt: true },
    });
    if (lastClosed?.clockOutAt && now.getTime() - lastClosed.clockOutAt.getTime() < cooldownMs) {
      return {
        ok: false,
        error: `${staffName} vừa quét ra lúc ${timeLabel(lastClosed.clockOutAt, tz)}. Đợi một chút rồi quét lại.`,
      };
    }
  }

  const nowMinute = minutesFromMidnightInTz(now, tz);
  const todayKey = localDateKey(now, tz);
  const notes: string[] = [];

  if (open) {
    // ── QUÉT RA ──────────────────────────────────────────────────────────────
    let earlyLeaveMin = 0;
    if (open.assignment) {
      earlyLeaveMin = earlyLeaveMinutes({
        actualMinute: nowMinute,
        plannedMinute: open.assignment.endMinute,
        toleranceMin: setting.toleranceMin,
      });
    }

    const worked = computeWorked({
      clockInAt: open.clockInAt,
      clockOutAt: now,
      breakMin: open.breakMin,
      autoDeductBreak: setting.autoDeductBreak,
      breakRule: { breakAfter6h: setting.breakAfter6h, breakAfter9h: setting.breakAfter9h },
      roundingMin: setting.roundingMin,
    });

    await db.timeEntry.update({
      where: { id: open.id },
      data: { clockOutAt: now, breakMin: worked.breakMin, earlyLeaveMin },
    });

    if (worked.breakMin > open.breakMin) {
      notes.push(`Đã tự trừ ${worked.breakMin} phút nghỉ theo luật giờ làm việc.`);
    }
    if (worked.workedMin > setting.maxDailyHours * 60) {
      notes.push(
        `Ca này dài ${formatDuration(worked.workedMin)}, vượt trần ${setting.maxDailyHours} tiếng một ngày.`,
      );
    }
    if (earlyLeaveMin > 0) notes.push(`Về sớm ${earlyLeaveMin} phút so với ca đã xếp.`);

    revalidatePath("/dashboard/timeclock");
    return {
      ok: true,
      action: "OUT",
      staffName,
      departmentName: staff.department?.name ?? null,
      atLabel: timeLabel(now, tz),
      shiftLabel: open.assignment?.template?.name ?? null,
      lateMin: open.lateMin,
      earlyLeaveMin,
      workedLabel: formatDuration(worked.workedMin),
      notes,
    };
  }

  // ── QUÉT VÀO ───────────────────────────────────────────────────────────────
  // Tìm ca gần giờ quét nhất. Quét cả ngày hôm qua và ngày mai vì ca đêm bắt
  // đầu hôm qua vẫn còn chạy, còn người đi sớm trước nửa đêm là ca của mai.
  const assignments = await db.shiftAssignment.findMany({
    where: {
      staffId: staff.id,
      businessId: ctx.businessId,
      status: { not: "CANCELLED" },
      date: {
        gte: dateKeyToUtcDate(addDays(todayKey, -1)),
        lte: dateKeyToUtcDate(addDays(todayKey, 1)),
      },
    },
    include: { template: { select: { name: true } } },
  });

  const punchAbsolute = dayIndex(todayKey) * MINUTES_PER_DAY + nowMinute;
  let matched: (typeof assignments)[number] | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const a of assignments) {
    const range = toAbsoluteRange({
      dateKey: utcDateToKey(a.date),
      startMinute: a.startMinute,
      endMinute: a.endMinute,
    });
    const distance = Math.abs(range.start - punchAbsolute);
    // Quá 4 tiếng lệch thì đó là ca khác chứ không phải người này đi muộn.
    if (distance <= 240 && distance < bestDistance) {
      bestDistance = distance;
      matched = a;
    }
  }

  const lateMin = matched
    ? lateMinutes({
        actualMinute: nowMinute,
        plannedMinute: matched.startMinute,
        toleranceMin: setting.toleranceMin,
      })
    : 0;

  // Có ngày nghỉ đã duyệt mà vẫn tới làm thì vẫn cho chấm công — người ta đang
  // đứng ở quán, giờ công đó là có thật — nhưng phải nói ra để quản lý biết.
  const absence = await db.staffAbsence.findFirst({
    where: {
      staffId: staff.id,
      status: "APPROVED",
      startDate: { lte: dateKeyToUtcDate(todayKey) },
      endDate: { gte: dateKeyToUtcDate(todayKey) },
    },
    select: { type: true },
  });
  if (absence) notes.push("Hôm nay nhân viên này đang trong kỳ nghỉ đã duyệt.");
  if (!matched) notes.push("Hôm nay không có ca nào được xếp cho người này.");
  if (lateMin > 0) notes.push(`Đi muộn ${lateMin} phút so với ca đã xếp.`);

  await db.timeEntry.create({
    data: {
      businessId: ctx.businessId,
      branchId: staff.branchId ?? ctx.branchId,
      staffId: staff.id,
      departmentId: matched?.departmentId ?? staff.departmentId,
      shiftAssignmentId: matched?.id ?? null,
      clockInAt: now,
      breakMin: matched?.breakMin ?? 0,
      source: "QR",
      lateMin,
    },
  });

  revalidatePath("/dashboard/timeclock");
  return {
    ok: true,
    action: "IN",
    staffName,
    departmentName: staff.department?.name ?? null,
    atLabel: timeLabel(now, tz),
    shiftLabel: matched?.template?.name ?? null,
    lateMin,
    earlyLeaveMin: 0,
    workedLabel: null,
    notes,
  };
}

const manualSchema = z.object({
  entryId: z.string().min(1),
  clockIn: z.string().regex(/^\d{2}:\d{2}$/, "Giờ vào không hợp lệ"),
  clockOut: z.string().regex(/^\d{2}:\d{2}$/, "Giờ ra không hợp lệ").optional().or(z.literal("")),
  breakMin: z.coerce.number().int().min(0).max(600),
  note: z.string().trim().max(500).optional(),
});

export interface ManualEditState {
  ok?: boolean;
  error?: string;
}

/**
 * Sửa tay một lần chấm công. Chỉ quản lý trở lên, và LUÔN ghi lại ai sửa —
 * bảng chấm công là chứng từ, ai cũng sửa được mà không để dấu thì nó vô giá trị.
 */
export async function editTimeEntry(
  _prev: ManualEditState,
  formData: FormData,
): Promise<ManualEditState> {
  const ctx = await requireBusinessContext();
  if (!hasAtLeast(ctx.role, "BUSINESS_MANAGER")) {
    return { ok: false, error: "Chỉ quản lý mới sửa được chấm công." };
  }

  const parsed = manualSchema.safeParse({
    entryId: formData.get("entryId"),
    clockIn: formData.get("clockIn"),
    clockOut: formData.get("clockOut") || "",
    breakMin: formData.get("breakMin") || 0,
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." };
  }
  const input = parsed.data;

  const entry = await db.timeEntry.findFirst({
    where: { id: input.entryId, businessId: ctx.businessId },
    select: { id: true, clockInAt: true },
  });
  if (!entry) return { ok: false, error: "Không tìm thấy lần chấm công." };

  const business = await db.business.findUnique({
    where: { id: ctx.businessId },
    select: { timezone: true },
  });
  const tz = business?.timezone || "Europe/Berlin";
  const dayKey = localDateKey(entry.clockInAt, tz);

  const clockInAt = localTimeToUtc(dayKey, input.clockIn, tz);
  let clockOutAt: Date | null = null;
  if (input.clockOut) {
    clockOutAt = localTimeToUtc(dayKey, input.clockOut, tz);
    // Giờ ra nhỏ hơn giờ vào nghĩa là ca qua đêm, cộng bù một ngày thay vì báo lỗi.
    if (clockOutAt.getTime() <= clockInAt.getTime()) {
      clockOutAt = new Date(clockOutAt.getTime() + 86_400_000);
    }
  }

  await db.timeEntry.update({
    where: { id: entry.id },
    data: {
      clockInAt,
      clockOutAt,
      breakMin: input.breakMin,
      note: input.note || null,
      source: "MANUAL",
      // Đã có người xem và sửa thì cờ "máy tự đóng" không còn đúng nữa.
      autoClosed: false,
      editedById: ctx.user.id,
      editedAt: new Date(),
    },
  });

  revalidatePath("/dashboard/timeclock");
  revalidatePath("/dashboard/timesheet");
  return { ok: true };
}

/**
 * Ghép ngày (theo lịch quán) với giờ địa phương thành mốc UTC.
 * Cùng cách làm với `toUtc` bên lịch hẹn: không dùng `new Date` trên chuỗi trần
 * vì nó lấy múi giờ máy chủ, mà máy chủ chạy UTC còn quán ở Berlin.
 */
function localTimeToUtc(dateKey: string, hhmm: string, timezone: string): Date {
  const naive = new Date(`${dateKey}T${hhmm}:00Z`);
  const asLocal = new Date(naive.toLocaleString("en-US", { timeZone: timezone || "Europe/Berlin" }));
  const asUtc = new Date(naive.toLocaleString("en-US", { timeZone: "UTC" }));
  return new Date(naive.getTime() + (asUtc.getTime() - asLocal.getTime()));
}
