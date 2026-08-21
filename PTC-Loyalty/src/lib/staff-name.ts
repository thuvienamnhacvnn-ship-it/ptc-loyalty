import type { Prisma } from "@prisma/client";

/**
 * Tên hiển thị của một người làm trong quán.
 *
 * Từ khi nhân viên không còn tài khoản đăng nhập, tên có thể nằm ở một trong
 * hai chỗ: `StaffProfile.name` (nhân viên thường) hoặc `User.name` (chủ quán,
 * quản lý). Gom về một hàm để không nơi nào còn viết `staff.user.name` — cách
 * viết đó nay ném lỗi vì `user` có thể là null.
 */

export interface StaffNameSource {
  name?: string | null;
  user?: { name?: string | null; email?: string | null } | null;
}

export function staffDisplayName(staff: StaffNameSource): string {
  const own = staff.name?.trim();
  if (own) return own;
  const fromUser = staff.user?.name?.trim();
  if (fromUser) return fromUser;
  return staff.user?.email ?? "Nhân viên";
}

/** Mẩu `select` kèm đủ trường cho `staffDisplayName`. */
export const staffNameSelect = {
  name: true,
  user: { select: { name: true, email: true } },
} satisfies Prisma.StaffProfileSelect;

/**
 * Điều kiện lọc "chỉ NHÂN VIÊN, bỏ chủ quán".
 *
 * Chủ quán buộc phải có một dòng StaffProfile vì `requireBusinessContext` dò
 * quán qua bảng đó, nhưng chủ không phải người làm công: không xếp ca, không
 * chấm công, không nằm trong bảng lương. Mọi danh sách nhân viên phải dùng bộ
 * lọc này thay vì tự viết lại điều kiện.
 */
export const workerWhere = { role: { not: "BUSINESS_OWNER" } } satisfies Prisma.StaffProfileWhereInput;
