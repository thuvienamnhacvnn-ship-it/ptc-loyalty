// Tin nhắn lịch hẹn (Termin) gửi từ chính số WhatsApp của quán.
//
// Không có template phải duyệt: Evolution API chạy WhatsApp Web Multi-Device
// nên đây chỉ là tin nhắn thường. Mọi hàm ở đây đều "im lặng bỏ qua" khi quán
// chưa ghép số — đặt lịch KHÔNG bao giờ được fail vì chuyện nhắn tin.

import { db } from "@/lib/db";
import { toWhatsAppNumber } from "@/lib/phone";
import { resolveSessionOrReason } from "./connection";
import { resolveBody } from "./service";
import { normalizeLanguage, type TemplateKey } from "./templates";
import { staffDisplayName } from "@/lib/staff-name";

/** Hai mốc nhắc lịch: trước một ngày và ngay trước giờ hẹn. */
export type ReminderSlot = "24h" | "2h";

export interface AppointmentNotifyResult {
  ok: boolean;
  /** Lý do không gửi — một trạng thái, không phải lỗi hệ thống. */
  skipped?: string;
  error?: string;
}

/** Định dạng thời điểm theo múi giờ của quán, bằng ngôn ngữ của tin nhắn. */
export function formatAppointmentTime(
  startAt: Date,
  timezone: string,
  language: string,
): string {
  const locale = language === "de" ? "de-DE" : language === "en" ? "en-GB" : "vi-VN";
  try {
    return new Intl.DateTimeFormat(locale, {
      weekday: "long",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: timezone || "Europe/Berlin",
    }).format(startAt);
  } catch {
    return startAt.toISOString().slice(0, 16).replace("T", " ");
  }
}

async function logSend(input: {
  businessId: string;
  customerId: string;
  toPhone: string;
  language: string;
  templateKey: string;
  text: string;
  /** Khoá chống ghi trùng, do chỗ gọi dựng vì mỗi mốc nhắc là một tin riêng. */
  idempotencyKey: string;
  ok: boolean;
  messageId?: string | null;
  error?: string;
}): Promise<void> {
  try {
    await db.whatsAppMessageLog.create({
      data: {
        businessId: input.businessId,
        customerId: input.customerId,
        kind: "APPOINTMENT",
        direction: "OUTBOUND",
        status: input.ok ? "SENT" : "FAILED",
        toPhone: input.toPhone,
        language: input.language,
        templateKey: input.templateKey,
        idempotencyKey: input.idempotencyKey,
        providerMessageId: input.ok ? (input.messageId ?? null) : null,
        payloadSnapshot: { direction: "outbound", textBody: input.text, preview: input.text },
        error: input.ok ? null : input.error,
        sentAt: input.ok ? new Date() : null,
        failedAt: input.ok ? null : new Date(),
      },
    });
  } catch (e) {
    console.error("[appointment-wa] log write failed:", e instanceof Error ? e.message : e);
  }
}

/**
 * Gửi một tin liên quan tới lịch hẹn. `key` quyết định nội dung; tham số được
 * dựng từ chính bản ghi Appointment nên chỗ gọi không phải tự ghép chuỗi.
 */
export async function sendAppointmentWhatsApp(input: {
  appointmentId: string;
  key: Extract<
    TemplateKey,
    "appointment_confirmed" | "appointment_reminder" | "appointment_cancelled"
  >;
  /**
   * Chỉ dùng với `appointment_reminder`: nhắc trước 24 tiếng hay trước 2 tiếng.
   * Hai mốc dùng CHUNG một templateKey nên nếu không tách ở đây thì khoá chống
   * trùng của hai tin sẽ đè nhau (`@@unique([businessId, idempotencyKey])`),
   * và cột mốc nào được đóng dấu cũng không xác định được.
   */
  reminderSlot?: ReminderSlot;
}): Promise<AppointmentNotifyResult> {
  try {
    const appt = await db.appointment.findUnique({
      where: { id: input.appointmentId },
      include: {
        business: { select: { name: true, timezone: true, addressLine: true, city: true } },
        customer: { select: { id: true, firstName: true, lastName: true, phone: true } },
        staff: { select: { user: { select: { name: true, email: true } } } },
        branch: { select: { name: true, addressLine: true, city: true } },
      },
    });
    if (!appt) return { ok: false, skipped: "not_found" };

    const phone = toWhatsAppNumber(appt.customer.phone);
    if (!phone) return { ok: false, skipped: "no_phone" };

    const attempt = await resolveSessionOrReason(appt.businessId);
    if (!attempt.ok) return { ok: false, skipped: attempt.reason };
    const { provider, session, connection } = attempt.value;
    const language = normalizeLanguage(connection.defaultLanguage);

    const customerName = `${appt.customer.firstName} ${appt.customer.lastName ?? ""}`.trim();
    const when = formatAppointmentTime(appt.startAt, appt.business.timezone, language);
    const staffName = appt.staff ? staffDisplayName(appt.staff) : "—";
    const service = appt.service?.trim() || "—";
    const address =
      [appt.branch?.addressLine ?? appt.business.addressLine, appt.branch?.city ?? appt.business.city]
        .filter(Boolean)
        .join(", ") || "—";

    const params =
      input.key === "appointment_confirmed"
        ? [appt.business.name, customerName, when, service, staffName, address]
        : input.key === "appointment_reminder"
          ? [appt.business.name, when, service, staffName]
          : [appt.business.name, when];

    const body = await resolveBody(appt.businessId, input.key, language, params);
    const result = await provider.sendText(session, phone, body);

    // Khoá theo lịch hẹn + loại tin (+ mốc nhắc), nên cron chạy lại không ghi trùng.
    const idempotencyKey = input.reminderSlot
      ? `${input.key}:${input.reminderSlot}:${appt.id}`
      : `${input.key}:${appt.id}`;

    await logSend({
      businessId: appt.businessId,
      customerId: appt.customer.id,
      toPhone: phone,
      language,
      templateKey: input.key,
      text: body,
      idempotencyKey,
      ok: result.ok,
      messageId: result.ok ? result.messageId : null,
      error: result.ok ? undefined : result.error,
    });

    if (!result.ok) return { ok: false, error: result.error };

    // Đánh dấu đã gửi để cron không bắn lại. Tin huỷ là một lần rồi thôi nên
    // không có cột mốc riêng.
    const stamp =
      input.key === "appointment_confirmed"
        ? { confirmSentAt: new Date() }
        : input.reminderSlot === "24h"
          ? { reminder24SentAt: new Date() }
          : input.reminderSlot === "2h"
            ? { reminder2SentAt: new Date() }
            : null;
    if (stamp) await db.appointment.update({ where: { id: appt.id }, data: stamp });

    return { ok: true };
  } catch (e) {
    console.error("[appointment-wa] send failed:", e instanceof Error ? e.message : e);
    return { ok: false, error: "exception" };
  }
}
