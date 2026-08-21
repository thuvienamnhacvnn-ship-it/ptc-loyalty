import { db } from "@/lib/db";
import { buildTimesheet, currentMonthKey, monthBounds } from "@/lib/timesheet";
import { localDateKey } from "@/lib/worktime";
import { notifyMonthlySummary } from "@/lib/whatsapp/staff-notify";

/**
 * Bảng tổng kết cuối tháng gửi cho từng nhân viên qua WhatsApp.
 *
 * Chạy MỖI NGÀY nhưng chỉ thực sự gửi vào ngày cuối tháng theo lịch của từng
 * quán. Lý do phải kiểm theo từng quán chứ không chốt một ngày cố định: quán
 * đặt múi giờ riêng, và "ngày cuối tháng" ở Berlin không trùng với ở UTC trong
 * vài giờ mỗi tháng — chạy theo UTC thì có quán nhận nhầm ngày.
 *
 * Chốt vào ngày cuối tháng chứ không phải ngày 1 tháng sau, vì nhân viên cần
 * đối chiếu khi trí nhớ còn nóng, và quán còn kịp sửa trước khi tính lương.
 */

export interface MonthlySummaryResult {
  businesses: number;
  /** Số quán thực sự tới ngày chốt hôm nay. */
  due: number;
  sent: number;
  skipped: number;
}

export async function runStaffMonthlySummary(now = new Date()): Promise<MonthlySummaryResult> {
  // Chỉ những quán đã bật chấm công mới có gì để tổng kết.
  const settings = await db.workTimeSetting.findMany({
    select: { businessId: true },
  });
  const result: MonthlySummaryResult = {
    businesses: settings.length,
    due: 0,
    sent: 0,
    skipped: 0,
  };

  for (const setting of settings) {
    const business = await db.business.findUnique({
      where: { id: setting.businessId },
      select: { id: true, timezone: true, status: true },
    });
    if (!business || business.status !== "ACTIVE") continue;

    const tz = business.timezone || "Europe/Berlin";
    const todayKey = localDateKey(now, tz);
    const monthKey = currentMonthKey(tz);
    const { lastDayKey } = monthBounds(monthKey);
    // Chưa tới ngày cuối tháng của quán này thì thôi.
    if (todayKey !== lastDayKey) continue;
    result.due += 1;

    // Không cần lương ở đây: tin nhắn cho nhân viên nói về NGÀY CÔNG và GIỜ,
    // còn tiền thì để quán tự trao đổi.
    const sheet = await buildTimesheet(business.id, monthKey, { includeWage: false });
    const [, m] = monthKey.split("-");
    const monthLabel = `${Number(m)}/${monthKey.slice(0, 4)}`;

    for (const row of sheet.rows) {
      // Người không làm ngày nào và cũng không nghỉ ngày nào thì không có gì
      // để tổng kết — đừng nhắn cho người đã nghỉ việc từ tháng trước.
      if (row.workedMin === 0 && row.absenceDays === 0 && row.plannedMin === 0) continue;

      const sent = await notifyMonthlySummary({
        businessId: business.id,
        staffProfileId: row.staffId,
        monthLabel,
        workedDays: row.days.filter((d) => d.workedMin > 0).length,
        absenceDays: row.absenceDays,
        workedMin: row.workedMin,
        plannedMin: row.plannedMin,
        lateCount: row.lateCount,
        missingCount: row.noShowCount,
      });
      if (sent.ok) result.sent += 1;
      else result.skipped += 1;
    }
  }

  return result;
}
