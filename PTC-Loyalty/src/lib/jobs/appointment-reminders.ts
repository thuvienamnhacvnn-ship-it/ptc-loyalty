// Nhắc lịch hẹn qua WhatsApp: một tin trước một ngày, một tin ngay trước giờ hẹn.
//
// Cron gọi vào đây mỗi 15 phút. Việc chọn ai được nhắn nằm gọn trong hàm thuần
// `dueReminder` để test được mà không cần DB; phần còn lại chỉ là đọc bảng và
// gọi hàm gửi.

import { db } from "@/lib/db";
import { sendAppointmentWhatsApp, type ReminderSlot } from "@/lib/whatsapp/appointment";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/**
 * Cửa sổ nhắc trước một ngày. Rộng 20–28 tiếng chứ không phải đúng 24 để cron
 * lỡ vài nhịp (VPS reboot, deploy) thì tin vẫn kịp đi.
 */
export const LEAD_24_MIN = 20 * HOUR;
export const LEAD_24_MAX = 28 * HOUR;

/** Nhắc lần hai khi giờ hẹn còn trong khoảng 2,5 tiếng đổ lại. */
export const LEAD_2_MAX = 150 * MINUTE;

/**
 * Khoảng lặng sau khi khách vừa nhận tin xác nhận. Đặt lịch cho ngày mai lúc
 * 18h thì tin xác nhận và tin nhắc "trước 24 tiếng" rơi vào cùng một buổi —
 * nhắn hai tin giống nhau cách nhau mươi phút trông như spam.
 */
export const QUIET_AFTER_CONFIRM_24 = 3 * HOUR;
/** Với mốc 2 tiếng thì khoảng lặng ngắn hơn, vì khách đặt sát giờ là chuyện thường. */
export const QUIET_AFTER_CONFIRM_2 = 45 * MINUTE;

export interface ReminderCandidate {
  startAt: Date;
  createdAt: Date;
  confirmSentAt: Date | null;
  reminder24SentAt: Date | null;
  reminder2SentAt: Date | null;
}

/**
 * Lịch hẹn này đang tới hạn nhắc ở mốc nào, hay chưa tới lượt (`null`).
 * Mốc 2 tiếng được xét trước: sát giờ thì tin đó quan trọng hơn.
 */
export function dueReminder(appt: ReminderCandidate, now: Date): ReminderSlot | null {
  const lead = appt.startAt.getTime() - now.getTime();
  if (lead <= 0) return null; // đã qua giờ hẹn, nhắc nữa là vô duyên

  const sinceBooking = now.getTime() - (appt.confirmSentAt ?? appt.createdAt).getTime();

  if (!appt.reminder2SentAt && lead <= LEAD_2_MAX) {
    return sinceBooking >= QUIET_AFTER_CONFIRM_2 ? "2h" : null;
  }
  if (!appt.reminder24SentAt && lead >= LEAD_24_MIN && lead <= LEAD_24_MAX) {
    return sinceBooking >= QUIET_AFTER_CONFIRM_24 ? "24h" : null;
  }
  return null;
}

export interface ReminderRunResult {
  scanned: number;
  sent: number;
  failed: number;
  /** Chưa tới hạn, quán chưa ghép WhatsApp, khách không có số… — không phải lỗi. */
  skipped: number;
}

/**
 * Quét các lịch hẹn sắp tới và gửi tin nhắc.
 *
 * Gửi TUẦN TỰ chứ không `Promise.all`: Evolution API chạy WhatsApp Web nên bắn
 * một loạt tin cùng lúc dễ làm số của quán bị Meta đánh dấu.
 */
export async function runAppointmentReminders(now = new Date()): Promise<ReminderRunResult> {
  const candidates = await db.appointment.findMany({
    where: {
      status: { in: ["BOOKED", "CONFIRMED"] },
      startAt: { gt: now, lte: new Date(now.getTime() + LEAD_24_MAX) },
      OR: [{ reminder24SentAt: null }, { reminder2SentAt: null }],
    },
    select: {
      id: true,
      startAt: true,
      createdAt: true,
      confirmSentAt: true,
      reminder24SentAt: true,
      reminder2SentAt: true,
    },
    orderBy: { startAt: "asc" },
    take: 500,
  });

  const result: ReminderRunResult = {
    scanned: candidates.length,
    sent: 0,
    failed: 0,
    skipped: 0,
  };

  for (const appt of candidates) {
    const slot = dueReminder(appt, now);
    if (!slot) {
      result.skipped++;
      continue;
    }

    const sendResult = await sendAppointmentWhatsApp({
      appointmentId: appt.id,
      key: "appointment_reminder",
      reminderSlot: slot,
    });

    if (sendResult.ok) result.sent++;
    else if (sendResult.skipped) result.skipped++;
    else result.failed++;
  }

  return result;
}
