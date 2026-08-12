import { describe, it, expect } from "vitest";
import { dueReminder, type ReminderCandidate } from "@/lib/jobs/appointment-reminders";

const NOW = new Date("2026-08-12T10:00:00Z");
const MIN = 60_000;
const HOUR = 60 * MIN;

/** Lịch hẹn cách `leadMs` nữa là tới, đặt từ lâu và đã gửi tin xác nhận. */
function appt(leadMs: number, over: Partial<ReminderCandidate> = {}): ReminderCandidate {
  const bookedAt = new Date(NOW.getTime() - 5 * 24 * HOUR);
  return {
    startAt: new Date(NOW.getTime() + leadMs),
    createdAt: bookedAt,
    confirmSentAt: bookedAt,
    reminder24SentAt: null,
    reminder2SentAt: null,
    ...over,
  };
}

describe("dueReminder", () => {
  it("nhắc trước một ngày khi giờ hẹn còn 20–28 tiếng", () => {
    expect(dueReminder(appt(24 * HOUR), NOW)).toBe("24h");
    expect(dueReminder(appt(20 * HOUR), NOW)).toBe("24h");
    expect(dueReminder(appt(28 * HOUR), NOW)).toBe("24h");
  });

  it("chưa tới cửa sổ nào thì im lặng", () => {
    expect(dueReminder(appt(29 * HOUR), NOW)).toBeNull();
    // Khoảng giữa 2,5h và 20h: tin 24h đã qua cửa sổ, tin 2h thì chưa tới.
    expect(dueReminder(appt(8 * HOUR), NOW)).toBeNull();
  });

  it("nhắc lần hai khi còn 2,5 tiếng đổ lại", () => {
    expect(dueReminder(appt(2 * HOUR), NOW)).toBe("2h");
    expect(dueReminder(appt(20 * MIN), NOW)).toBe("2h");
  });

  it("không nhắc lại mốc đã gửi", () => {
    expect(dueReminder(appt(24 * HOUR, { reminder24SentAt: NOW }), NOW)).toBeNull();
    expect(dueReminder(appt(90 * MIN, { reminder2SentAt: NOW }), NOW)).toBeNull();
  });

  it("mốc 2 tiếng vẫn chạy dù mốc 24 tiếng chưa từng gửi", () => {
    // Khách đặt sát ngày thì không bao giờ lọt cửa sổ 24h — đừng để nó chặn tin cuối.
    expect(dueReminder(appt(60 * MIN, { reminder24SentAt: null }), NOW)).toBe("2h");
  });

  it("qua giờ hẹn rồi thì thôi", () => {
    expect(dueReminder(appt(-10 * MIN), NOW)).toBeNull();
    expect(dueReminder(appt(0), NOW)).toBeNull();
  });

  it("vừa đặt xong thì chưa nhắc, tránh hai tin sát nhau", () => {
    const justBooked = new Date(NOW.getTime() - 10 * MIN);
    expect(
      dueReminder(appt(22 * HOUR, { createdAt: justBooked, confirmSentAt: justBooked }), NOW),
    ).toBeNull();
    expect(
      dueReminder(appt(2 * HOUR, { createdAt: justBooked, confirmSentAt: justBooked }), NOW),
    ).toBeNull();
  });

  it("hết khoảng lặng thì nhắc bình thường", () => {
    const booked4hAgo = new Date(NOW.getTime() - 4 * HOUR);
    expect(
      dueReminder(appt(22 * HOUR, { createdAt: booked4hAgo, confirmSentAt: booked4hAgo }), NOW),
    ).toBe("24h");
    const booked1hAgo = new Date(NOW.getTime() - 1 * HOUR);
    expect(
      dueReminder(appt(2 * HOUR, { createdAt: booked1hAgo, confirmSentAt: booked1hAgo }), NOW),
    ).toBe("2h");
  });

  it("quán chưa ghép WhatsApp (không có confirmSentAt) thì tính theo lúc tạo lịch", () => {
    const bookedLongAgo = new Date(NOW.getTime() - 2 * 24 * HOUR);
    expect(
      dueReminder(appt(24 * HOUR, { confirmSentAt: null, createdAt: bookedLongAgo }), NOW),
    ).toBe("24h");
  });
});
