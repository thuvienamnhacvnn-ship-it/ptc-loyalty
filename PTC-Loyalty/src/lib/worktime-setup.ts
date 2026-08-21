import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { staffNameSelect, workerWhere } from "@/lib/staff-name";

/**
 * Dựng sẵn bộ phận, khuôn ca và quy tắc chấm công cho một quán.
 *
 * Chạy lười (lazy) ở lần đầu quán mở màn hình xếp ca, không nhét vào luồng
 * đăng ký: phần lớn quán dùng tích điểm chứ không dùng chấm công, tạo sẵn cho
 * tất cả chỉ tổ đẻ rác. Mọi thao tác đều là upsert nên gọi lại nhiều lần vô
 * hại, và KHÔNG đụng tới thứ quán đã tự sửa.
 */

/** Bộ phận mặc định theo loại hình quán. Quán ăn mới cần chia bộ phận. */
const DEFAULT_DEPARTMENTS: Record<string, { name: string; colorHex: string }[]> = {
  restaurant: [
    { name: "Küche", colorHex: "#EA580C" }, // bếp
    { name: "Bar-Service", colorHex: "#7C3AED" }, // quầy bar
    { name: "Service", colorHex: "#0EA5E9" }, // chạy bàn
  ],
  cafe: [
    { name: "Küche", colorHex: "#EA580C" },
    { name: "Bar-Service", colorHex: "#7C3AED" },
    { name: "Service", colorHex: "#0EA5E9" },
  ],
};

/**
 * Khuôn ca mặc định. Giờ khác nhau theo loại hình vì nhịp làm việc khác nhau:
 * quán ăn chạy tới khuya, tiệm nail đóng cửa lúc chiều tối.
 */
const DEFAULT_SHIFTS: Record<
  string,
  { name: string; startMinute: number; endMinute: number; breakMin: number; colorHex: string }[]
> = {
  restaurant: [
    { name: "Ca sáng", startMinute: 10 * 60, endMinute: 16 * 60, breakMin: 30, colorHex: "#F59E0B" },
    { name: "Ca chiều", startMinute: 16 * 60, endMinute: 23 * 60, breakMin: 30, colorHex: "#1E3A8A" },
  ],
  cafe: [
    { name: "Ca sáng", startMinute: 8 * 60, endMinute: 14 * 60, breakMin: 30, colorHex: "#F59E0B" },
    { name: "Ca chiều", startMinute: 14 * 60, endMinute: 20 * 60, breakMin: 30, colorHex: "#1E3A8A" },
  ],
  default: [
    { name: "Ca sáng", startMinute: 9 * 60, endMinute: 14 * 60, breakMin: 30, colorHex: "#F59E0B" },
    { name: "Ca chiều", startMinute: 14 * 60, endMinute: 19 * 60, breakMin: 30, colorHex: "#1E3A8A" },
  ],
};

/** Loại hình quán này có chia bộ phận không (quán ăn thì có). */
export function usesDepartments(businessType: string): boolean {
  return businessType in DEFAULT_DEPARTMENTS;
}

/** Quy tắc chấm công của quán, tạo bản mặc định nếu chưa có. */
export async function getWorkTimeSetting(businessId: string) {
  const existing = await db.workTimeSetting.findUnique({ where: { businessId } });
  if (existing) return existing;
  // Hai người cùng mở màn hình chấm công một lúc thì cả hai cùng tạo — bắt lỗi
  // trùng khoá rồi đọc lại, thay vì để một người thấy màn hình lỗi.
  try {
    return await db.workTimeSetting.create({ data: { businessId } });
  } catch {
    const again = await db.workTimeSetting.findUnique({ where: { businessId } });
    if (again) return again;
    throw new Error("Không tạo được cấu hình chấm công.");
  }
}

/**
 * Tạo bộ phận + khuôn ca mặc định cho quán nếu quán chưa có gì.
 * Chỉ seed khi bảng còn RỖNG — quán đã xoá "Bar-Service" vì không dùng thì
 * không được phép thấy nó mọc lại ở lần mở trang sau.
 */
export async function ensureScheduleDefaults(businessId: string, businessType: string) {
  const [deptCount, shiftCount] = await Promise.all([
    db.department.count({ where: { businessId } }),
    db.shiftTemplate.count({ where: { businessId } }),
  ]);

  const departments = DEFAULT_DEPARTMENTS[businessType] ?? [];
  if (deptCount === 0 && departments.length > 0) {
    await db.department.createMany({
      data: departments.map((d, i) => ({ businessId, ...d, sortOrder: i })),
      skipDuplicates: true,
    });
  }

  if (shiftCount === 0) {
    const shifts = DEFAULT_SHIFTS[businessType] ?? DEFAULT_SHIFTS.default;
    await db.shiftTemplate.createMany({
      data: shifts.map((s, i) => ({ businessId, ...s, sortOrder: i })),
      skipDuplicates: true,
    });
  }
}

/**
 * Nhân viên còn làm việc của quán, kèm bộ phận — dùng chung cho xếp ca, chấm
 * công và bảng công nên gom về một chỗ để mọi màn hình sắp cùng thứ tự.
 */
export const staffForScheduleSelect = {
  id: true,
  employeeNo: true,
  weeklyHours: true,
  isActive: true,
  ...staffNameSelect,
  department: { select: { id: true, name: true, colorHex: true } },
} satisfies Prisma.StaffProfileSelect;

export async function listSchedulableStaff(businessId: string) {
  return db.staffProfile.findMany({
    where: { businessId, isActive: true, ...workerWhere },
    select: staffForScheduleSelect,
    orderBy: [{ department: { sortOrder: "asc" } }, { createdAt: "asc" }],
  });
}
