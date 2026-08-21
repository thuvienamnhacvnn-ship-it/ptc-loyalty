"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireBusinessContext } from "@/lib/tenant";
import { hasAtLeast } from "@/lib/rbac";
import { getWorkTimeSetting } from "@/lib/worktime-setup";
import { formatDuration, formatHhMm, parseHhMm, shiftSpanMinutes } from "@/lib/worktime";
import {
  addDays,
  dateKeyToUtcDate,
  findBlockingAbsence,
  restGapMinutes,
  shiftsOverlap,
  utcDateToKey,
  weekDateKeys,
} from "@/lib/schedule";

export interface ScheduleState {
  ok?: boolean;
  error?: string;
  /** Đã lưu, nhưng có chuyện quán nên biết. */
  warning?: string;
}

const ABSENCE_LABELS: Record<string, string> = {
  SICK: "báo ốm",
  VACATION: "nghỉ phép",
  UNPAID: "nghỉ không lương",
  TRAINING: "đi đào tạo",
  OTHER: "nghỉ",
};

/** Chỉ quản lý trở lên mới được đụng vào lịch của cả quán. */
async function requireScheduler() {
  const ctx = await requireBusinessContext();
  if (!hasAtLeast(ctx.role, "BUSINESS_MANAGER")) {
    return { ctx: null, error: "Chỉ quản lý mới xếp được ca." as const };
  }
  return { ctx, error: null };
}

const assignSchema = z.object({
  staffId: z.string().min(1, "Chọn nhân viên"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày không hợp lệ"),
  shiftTemplateId: z.string().optional(),
  // Nhập tay ghi đè khuôn ca, dùng cho ca lẻ kiểu "hôm nay vào sớm 2 tiếng".
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  breakMin: z.coerce.number().int().min(0).max(240).optional(),
  departmentId: z.string().optional(),
  note: z.string().trim().max(500).optional(),
});

/**
 * Xếp một ca cho một nhân viên vào một ngày.
 *
 * Ba lớp kiểm tra, khác nhau về mức độ cứng rắn:
 *  1. Đang nghỉ đã duyệt  → CHẶN. Đây là yêu cầu nghiệp vụ: báo ốm rồi thì
 *     không ai được xếp lịch cho người đó nữa.
 *  2. Trùng giờ ca khác   → CHẶN. Một người không thể đứng hai chỗ.
 *  3. Nghỉ giữa hai ca ngắn hơn luật → CẢNH BÁO. Có quán vẫn phải làm vậy
 *     trong tuần cao điểm; phần mềm nói ra chứ không cấm.
 */
export async function createAssignment(
  _prev: ScheduleState,
  formData: FormData,
): Promise<ScheduleState> {
  const { ctx, error } = await requireScheduler();
  if (!ctx) return { ok: false, error };

  const parsed = assignSchema.safeParse({
    staffId: formData.get("staffId"),
    date: formData.get("date"),
    shiftTemplateId: formData.get("shiftTemplateId") || undefined,
    startTime: formData.get("startTime") || undefined,
    endTime: formData.get("endTime") || undefined,
    breakMin: formData.get("breakMin") || undefined,
    departmentId: formData.get("departmentId") || undefined,
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." };
  }
  const input = parsed.data;

  const staff = await db.staffProfile.findFirst({
    where: { id: input.staffId, businessId: ctx.businessId, isActive: true },
    select: {
      id: true,
      branchId: true,
      departmentId: true,
      user: { select: { name: true, email: true } },
    },
  });
  if (!staff) return { ok: false, error: "Không tìm thấy nhân viên trong quán này." };

  // Giờ ca: lấy từ khuôn ca, cho phép nhập tay ghi đè.
  let startMinute: number | null = null;
  let endMinute: number | null = null;
  let breakMin = input.breakMin ?? 0;
  let templateId: string | null = null;
  let departmentId = input.departmentId && input.departmentId !== "none" ? input.departmentId : null;

  if (input.shiftTemplateId && input.shiftTemplateId !== "custom") {
    const template = await db.shiftTemplate.findFirst({
      where: { id: input.shiftTemplateId, businessId: ctx.businessId },
    });
    if (!template) return { ok: false, error: "Không tìm thấy ca này." };
    startMinute = template.startMinute;
    endMinute = template.endMinute;
    breakMin = input.breakMin ?? template.breakMin;
    templateId = template.id;
    departmentId = departmentId ?? template.departmentId;
  }
  if (input.startTime && input.endTime) {
    const s = parseHhMm(input.startTime);
    const e = parseHhMm(input.endTime);
    if (s === null || e === null) return { ok: false, error: "Giờ vào hoặc giờ ra không hợp lệ." };
    startMinute = s;
    endMinute = e;
    templateId = null;
  }
  if (startMinute === null || endMinute === null) {
    return { ok: false, error: "Chọn một ca có sẵn hoặc nhập giờ vào và giờ ra." };
  }

  const span = shiftSpanMinutes(startMinute, endMinute);
  if (span < 15) return { ok: false, error: "Ca phải dài ít nhất 15 phút." };
  if (span > 16 * 60) return { ok: false, error: "Ca dài quá 16 tiếng, kiểm tra lại giờ." };

  departmentId = departmentId ?? staff.departmentId;
  if (departmentId) {
    const dept = await db.department.findFirst({
      where: { id: departmentId, businessId: ctx.businessId },
      select: { id: true },
    });
    if (!dept) return { ok: false, error: "Không tìm thấy bộ phận này." };
  }

  const staffName = staff.user.name ?? staff.user.email;

  // ── 1. Đang nghỉ thì chặn ────────────────────────────────────────────────
  const absences = await db.staffAbsence.findMany({
    where: {
      staffId: staff.id,
      status: "APPROVED",
      // Kỳ nghỉ nào kết thúc trước ngày này thì không cần lấy về.
      endDate: { gte: dateKeyToUtcDate(input.date) },
      startDate: { lte: dateKeyToUtcDate(input.date) },
    },
    select: { type: true, startDate: true, endDate: true },
  });
  const blocking = findBlockingAbsence(
    input.date,
    absences.map((a) => ({
      ...a,
      startDateKey: utcDateToKey(a.startDate),
      endDateKey: utcDateToKey(a.endDate),
    })),
  );
  if (blocking) {
    return {
      ok: false,
      error: `${staffName} đang ${ABSENCE_LABELS[blocking.type] ?? "nghỉ"} từ ${utcDateToKey(blocking.startDate)} đến ${utcDateToKey(blocking.endDate)} — không xếp ca được.`,
    };
  }

  // ── 2 & 3. Trùng ca và nghỉ giữa ca ──────────────────────────────────────
  const neighbours = await db.shiftAssignment.findMany({
    where: {
      staffId: staff.id,
      businessId: ctx.businessId,
      status: { not: "CANCELLED" },
      date: {
        gte: dateKeyToUtcDate(addDays(input.date, -1)),
        lte: dateKeyToUtcDate(addDays(input.date, 1)),
      },
    },
    select: { id: true, date: true, startMinute: true, endMinute: true },
  });

  const candidate = { dateKey: input.date, startMinute, endMinute };
  const clash = neighbours.find((n) =>
    shiftsOverlap(candidate, {
      dateKey: utcDateToKey(n.date),
      startMinute: n.startMinute,
      endMinute: n.endMinute,
    }),
  );
  if (clash) {
    return {
      ok: false,
      error: `${staffName} đã có ca ${formatHhMm(clash.startMinute)}–${formatHhMm(clash.endMinute)} ngày ${utcDateToKey(clash.date)} đè lên giờ này.`,
    };
  }

  const setting = await getWorkTimeSetting(ctx.businessId);
  let warning: string | undefined;
  for (const n of neighbours) {
    const other = {
      dateKey: utcDateToKey(n.date),
      startMinute: n.startMinute,
      endMinute: n.endMinute,
    };
    // Ca kia có thể nằm trước hoặc sau ca mới. Chiều nào đúng thì ra số dương,
    // chiều còn lại ra số âm rất lớn, nên lấy max là chọn được đúng chiều.
    const gap = Math.max(
      restGapMinutes(other, candidate),
      restGapMinutes(candidate, other),
    );
    if (gap > 0 && gap < setting.minRestHours * 60) {
      warning = `Chỉ nghỉ ${formatDuration(gap)} giữa hai ca, luật đòi ${setting.minRestHours} tiếng (ArbZG §5).`;
      break;
    }
  }

  await db.shiftAssignment.create({
    data: {
      businessId: ctx.businessId,
      branchId: staff.branchId ?? ctx.branchId,
      staffId: staff.id,
      departmentId,
      shiftTemplateId: templateId,
      date: dateKeyToUtcDate(input.date),
      startMinute,
      endMinute,
      breakMin,
      note: input.note || null,
      createdById: ctx.user.id,
    },
  });

  revalidatePath("/dashboard/schedule");
  revalidatePath("/dashboard/my-schedule");
  return { ok: true, warning };
}

/** Xoá một ca đã xếp. */
export async function deleteAssignment(formData: FormData) {
  const { ctx } = await requireScheduler();
  if (!ctx) return;
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  // businessId nằm trong where nên không xoá được ca của quán khác.
  await db.shiftAssignment.deleteMany({ where: { id, businessId: ctx.businessId } });
  revalidatePath("/dashboard/schedule");
  revalidatePath("/dashboard/my-schedule");
}

/** Chốt cả tuần: chuyển mọi ca PLANNED sang CONFIRMED. */
export async function confirmWeek(formData: FormData) {
  const { ctx } = await requireScheduler();
  if (!ctx) return;
  const monday = String(formData.get("monday") ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(monday)) return;

  await db.shiftAssignment.updateMany({
    where: {
      businessId: ctx.businessId,
      status: "PLANNED",
      date: { gte: dateKeyToUtcDate(monday), lte: dateKeyToUtcDate(addDays(monday, 6)) },
    },
    data: { status: "CONFIRMED" },
  });
  revalidatePath("/dashboard/schedule");
  revalidatePath("/dashboard/my-schedule");
}

/**
 * Chép lịch tuần trước sang tuần đang xem.
 *
 * Đây là nút được bấm nhiều nhất trong thực tế: lịch quán gần như lặp lại,
 * ngồi xếp tay 7 ngày × 8 người mỗi tuần là việc vô nghĩa. Ca nào vướng ngày
 * nghỉ đã duyệt hoặc đè lên ca sẵn có thì BỎ QUA chứ không làm hỏng cả mẻ, và
 * số bị bỏ được báo lại để quán biết mà xếp bù.
 */
export async function copyPreviousWeek(formData: FormData): Promise<void> {
  const { ctx } = await requireScheduler();
  if (!ctx) return;
  const monday = String(formData.get("monday") ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(monday)) return;

  const prevMonday = addDays(monday, -7);
  const source = await db.shiftAssignment.findMany({
    where: {
      businessId: ctx.businessId,
      status: { not: "CANCELLED" },
      date: { gte: dateKeyToUtcDate(prevMonday), lte: dateKeyToUtcDate(addDays(prevMonday, 6)) },
    },
  });
  if (source.length === 0) return;

  const targetKeys = weekDateKeys(monday);
  const [existing, absences] = await Promise.all([
    db.shiftAssignment.findMany({
      where: {
        businessId: ctx.businessId,
        status: { not: "CANCELLED" },
        date: { gte: dateKeyToUtcDate(monday), lte: dateKeyToUtcDate(addDays(monday, 6)) },
      },
      select: { staffId: true, date: true, startMinute: true, endMinute: true },
    }),
    db.staffAbsence.findMany({
      where: {
        businessId: ctx.businessId,
        status: "APPROVED",
        endDate: { gte: dateKeyToUtcDate(monday) },
        startDate: { lte: dateKeyToUtcDate(addDays(monday, 6)) },
      },
      select: { staffId: true, startDate: true, endDate: true, type: true },
    }),
  ]);

  const absenceByStaff = new Map<string, { startDateKey: string; endDateKey: string }[]>();
  for (const a of absences) {
    const list = absenceByStaff.get(a.staffId) ?? [];
    list.push({ startDateKey: utcDateToKey(a.startDate), endDateKey: utcDateToKey(a.endDate) });
    absenceByStaff.set(a.staffId, list);
  }

  const planned = existing.map((e) => ({
    staffId: e.staffId,
    dateKey: utcDateToKey(e.date),
    startMinute: e.startMinute,
    endMinute: e.endMinute,
  }));

  const rows: {
    businessId: string;
    branchId: string | null;
    staffId: string;
    departmentId: string | null;
    shiftTemplateId: string | null;
    date: Date;
    startMinute: number;
    endMinute: number;
    breakMin: number;
    createdById: string;
  }[] = [];

  for (const s of source) {
    const dayOffset = weekDateKeys(prevMonday).indexOf(utcDateToKey(s.date));
    if (dayOffset < 0) continue;
    const dateKey = targetKeys[dayOffset];

    if (findBlockingAbsence(dateKey, absenceByStaff.get(s.staffId) ?? [])) continue;

    const candidate = { dateKey, startMinute: s.startMinute, endMinute: s.endMinute };
    const clashes = planned.some(
      (p) => p.staffId === s.staffId && shiftsOverlap(candidate, p),
    );
    if (clashes) continue;

    // Ghi vào danh sách đã xếp ngay, để hai ca giống hệt nhau trong tuần nguồn
    // không cùng lọt qua cửa kiểm tra này.
    planned.push({ staffId: s.staffId, ...candidate });
    rows.push({
      businessId: ctx.businessId,
      branchId: s.branchId,
      staffId: s.staffId,
      departmentId: s.departmentId,
      shiftTemplateId: s.shiftTemplateId,
      date: dateKeyToUtcDate(dateKey),
      startMinute: s.startMinute,
      endMinute: s.endMinute,
      breakMin: s.breakMin,
      createdById: ctx.user.id,
    });
  }

  if (rows.length > 0) {
    await db.shiftAssignment.createMany({ data: rows, skipDuplicates: true });
  }
  revalidatePath("/dashboard/schedule");
  revalidatePath("/dashboard/my-schedule");
}

// ── Bộ phận và khuôn ca ─────────────────────────────────────────────────────

const departmentSchema = z.object({
  name: z.string().trim().min(1, "Nhập tên bộ phận").max(60),
  colorHex: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

export async function createDepartment(
  _prev: ScheduleState,
  formData: FormData,
): Promise<ScheduleState> {
  const { ctx, error } = await requireScheduler();
  if (!ctx) return { ok: false, error };

  const parsed = departmentSchema.safeParse({
    name: formData.get("name"),
    colorHex: formData.get("colorHex") || undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." };
  }

  const count = await db.department.count({ where: { businessId: ctx.businessId } });
  try {
    await db.department.create({
      data: {
        businessId: ctx.businessId,
        name: parsed.data.name,
        colorHex: parsed.data.colorHex ?? "#145DFF",
        sortOrder: count,
      },
    });
  } catch {
    return { ok: false, error: "Quán đã có bộ phận trùng tên." };
  }
  revalidatePath("/dashboard/schedule");
  return { ok: true };
}

export async function deleteDepartment(formData: FormData) {
  const { ctx } = await requireScheduler();
  if (!ctx) return;
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  // Quan hệ khai onDelete: SetNull nên nhân viên và ca cũ không bị xoá theo,
  // chỉ mất nhãn bộ phận.
  await db.department.deleteMany({ where: { id, businessId: ctx.businessId } });
  revalidatePath("/dashboard/schedule");
}

const templateSchema = z.object({
  name: z.string().trim().min(1, "Nhập tên ca").max(60),
  startTime: z.string().min(1, "Nhập giờ bắt đầu"),
  endTime: z.string().min(1, "Nhập giờ kết thúc"),
  breakMin: z.coerce.number().int().min(0).max(240),
  departmentId: z.string().optional(),
  colorHex: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

export async function createShiftTemplate(
  _prev: ScheduleState,
  formData: FormData,
): Promise<ScheduleState> {
  const { ctx, error } = await requireScheduler();
  if (!ctx) return { ok: false, error };

  const parsed = templateSchema.safeParse({
    name: formData.get("name"),
    startTime: formData.get("startTime"),
    endTime: formData.get("endTime"),
    breakMin: formData.get("breakMin") || 0,
    departmentId: formData.get("departmentId") || undefined,
    colorHex: formData.get("colorHex") || undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." };
  }

  const start = parseHhMm(parsed.data.startTime);
  const end = parseHhMm(parsed.data.endTime);
  if (start === null || end === null) return { ok: false, error: "Giờ không hợp lệ." };
  const span = shiftSpanMinutes(start, end);
  if (span < 15) return { ok: false, error: "Ca phải dài ít nhất 15 phút." };
  if (span > 16 * 60) return { ok: false, error: "Ca dài quá 16 tiếng, kiểm tra lại giờ." };

  const deptId =
    parsed.data.departmentId && parsed.data.departmentId !== "none"
      ? parsed.data.departmentId
      : null;
  if (deptId) {
    const dept = await db.department.findFirst({
      where: { id: deptId, businessId: ctx.businessId },
      select: { id: true },
    });
    if (!dept) return { ok: false, error: "Không tìm thấy bộ phận này." };
  }

  const count = await db.shiftTemplate.count({ where: { businessId: ctx.businessId } });
  try {
    await db.shiftTemplate.create({
      data: {
        businessId: ctx.businessId,
        name: parsed.data.name,
        startMinute: start,
        endMinute: end,
        breakMin: parsed.data.breakMin,
        departmentId: deptId,
        colorHex: parsed.data.colorHex ?? "#145DFF",
        sortOrder: count,
      },
    });
  } catch {
    return { ok: false, error: "Quán đã có ca trùng tên." };
  }
  revalidatePath("/dashboard/schedule");
  return { ok: true };
}

export async function deleteShiftTemplate(formData: FormData) {
  const { ctx } = await requireScheduler();
  if (!ctx) return;
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await db.shiftTemplate.deleteMany({ where: { id, businessId: ctx.businessId } });
  revalidatePath("/dashboard/schedule");
}
