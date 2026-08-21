import { db } from "@/lib/db";

/**
 * Dọn những ca "quên quét ra".
 *
 * Nhân viên tan ca vội, quên dí thẻ lần thứ hai, và ca đó nằm mở vô hạn: hôm
 * sau người ta quét vào thì hệ thống lại hiểu là quét RA của ca hôm trước, thành
 * một ca dài 20 tiếng. Cron này đóng ca quá hạn lại và gắn cờ `autoClosed` để
 * bảng công biết con số đó KHÔNG đáng tin và quản lý phải sửa tay.
 *
 * Đóng vào đúng giờ ca lẽ ra phải kết thúc chứ không phải giờ chạy cron — đoán
 * theo ca đã xếp luôn gần sự thật hơn là để nguyên tới lúc cron chạy.
 */
export interface AutoCloseResult {
  scanned: number;
  closed: number;
}

export async function runTimeclockAutoClose(now = new Date()): Promise<AutoCloseResult> {
  const settings = await db.workTimeSetting.findMany({
    select: { businessId: true, autoCloseHours: true },
  });
  if (settings.length === 0) return { scanned: 0, closed: 0 };

  let scanned = 0;
  let closed = 0;

  for (const setting of settings) {
    const cutoff = new Date(now.getTime() - setting.autoCloseHours * 3_600_000);
    const stale = await db.timeEntry.findMany({
      where: {
        businessId: setting.businessId,
        clockOutAt: null,
        clockInAt: { lt: cutoff },
      },
      include: { assignment: { select: { startMinute: true, endMinute: true } } },
    });
    scanned += stale.length;

    for (const entry of stale) {
      let clockOutAt: Date;
      if (entry.assignment) {
        // Độ dài ca theo kế hoạch, xử lý cả ca qua đêm.
        const span =
          entry.assignment.endMinute > entry.assignment.startMinute
            ? entry.assignment.endMinute - entry.assignment.startMinute
            : entry.assignment.endMinute - entry.assignment.startMinute + 1440;
        clockOutAt = new Date(entry.clockInAt.getTime() + span * 60_000);
      } else {
        // Không có ca thì lấy trần giờ làm một ngày, đừng đoán rộng tay hơn.
        clockOutAt = new Date(entry.clockInAt.getTime() + 8 * 3_600_000);
      }
      // Không được đóng ở tương lai — cron chạy muộn cũng không sinh ra giờ công chưa xảy ra.
      if (clockOutAt > now) clockOutAt = now;

      await db.timeEntry.update({
        where: { id: entry.id },
        data: { clockOutAt, autoClosed: true, source: "AUTO_CLOSE" },
      });
      closed += 1;
    }
  }

  return { scanned, closed };
}
