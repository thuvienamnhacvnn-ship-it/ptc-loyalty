"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireBusinessContext } from "@/lib/tenant";
import { sendAppointmentWhatsApp } from "@/lib/whatsapp/appointment";

export interface AppointmentState {
  ok?: boolean;
  error?: string;
  /** Cảnh báo mềm: đã lưu nhưng thợ đó bị trùng giờ. */
  warning?: string;
  fieldErrors?: Partial<
    Record<"customerId" | "date" | "time" | "durationMin" | "service" | "staffId", string[]>
  >;
}

const createSchema = z.object({
  customerId: z.string().min(1, "Chọn khách hàng"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày không hợp lệ"),
  time: z.string().regex(/^\d{2}:\d{2}$/, "Giờ không hợp lệ"),
  durationMin: z.coerce.number().int().min(5, "Tối thiểu 5 phút").max(600, "Tối đa 10 tiếng"),
  service: z.string().trim().max(120).optional(),
  staffId: z.string().trim().optional(),
  note: z.string().trim().max(1000).optional(),
});

/**
 * Ghép ngày + giờ do nhân viên nhập (giờ địa phương của quán) thành mốc UTC.
 *
 * Không dùng `new Date("...")` trên chuỗi trần vì nó lấy múi giờ của MÁY CHỦ —
 * server chạy UTC còn quán ở Berlin thì lệch 1–2 tiếng, đủ để tin nhắn nhắc
 * lịch bắn sai giờ.
 */
function toUtc(date: string, time: string, timezone: string): Date {
  const naive = new Date(`${date}T${time}:00Z`);
  // Chênh lệch giữa cùng một mốc khi đọc ở timezone của quán và ở UTC.
  const asLocal = new Date(
    naive.toLocaleString("en-US", { timeZone: timezone || "Europe/Berlin" }),
  );
  const asUtc = new Date(naive.toLocaleString("en-US", { timeZone: "UTC" }));
  return new Date(naive.getTime() + (asUtc.getTime() - asLocal.getTime()));
}

export async function createAppointment(
  _prev: AppointmentState,
  formData: FormData,
): Promise<AppointmentState> {
  const ctx = await requireBusinessContext();

  const parsed = createSchema.safeParse({
    customerId: formData.get("customerId"),
    date: formData.get("date"),
    time: formData.get("time"),
    durationMin: formData.get("durationMin") || 60,
    service: formData.get("service") || undefined,
    staffId: formData.get("staffId") || undefined,
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) {
    return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const input = parsed.data;

  // Khách phải thuộc đúng quán này.
  const customer = await db.customerProfile.findFirst({
    where: { id: input.customerId, businessId: ctx.businessId },
    select: { id: true, phone: true },
  });
  if (!customer) return { ok: false, error: "Không tìm thấy khách hàng trong quán này." };

  const business = await db.business.findUnique({
    where: { id: ctx.businessId },
    select: { timezone: true },
  });
  const startAt = toUtc(input.date, input.time, business?.timezone ?? "Europe/Berlin");
  if (Number.isNaN(startAt.getTime())) {
    return { ok: false, error: "Ngày giờ không hợp lệ." };
  }

  const staffId = input.staffId && input.staffId !== "none" ? input.staffId : null;
  if (staffId) {
    const staff = await db.staffProfile.findFirst({
      where: { id: staffId, businessId: ctx.businessId },
      select: { id: true },
    });
    if (!staff) return { ok: false, error: "Không tìm thấy nhân viên trong quán này." };
  }

  // Chưa có giờ làm của từng thợ nên không tính được khung trống — chỉ soi xem
  // lịch mới có đè lên lịch nào của cùng thợ không, rồi CẢNH BÁO chứ không chặn.
  let warning: string | undefined;
  if (staffId) {
    const endAt = new Date(startAt.getTime() + input.durationMin * 60_000);
    // Không thể so `startAt + durationMin` ngay trong câu truy vấn, nên lấy về
    // mọi lịch có thể chạm tới khoảng này rồi so trong JS. MAX_DURATION_MIN là
    // trần thời lượng nên không có lịch nào bắt đầu sớm hơn thế mà còn kéo dài
    // tới đây được.
    const MAX_DURATION_MIN = 600;
    const candidates = await db.appointment.findMany({
      where: {
        businessId: ctx.businessId,
        staffId,
        status: { in: ["BOOKED", "CONFIRMED"] },
        startAt: {
          gte: new Date(startAt.getTime() - MAX_DURATION_MIN * 60_000),
          lt: endAt,
        },
      },
      select: { startAt: true, durationMin: true },
    });
    const clash = candidates.some(
      (c) => new Date(c.startAt.getTime() + c.durationMin * 60_000) > startAt,
    );
    if (clash) {
      warning = "Thợ này đã có lịch trùng giờ — đã lưu nhưng hãy kiểm tra lại.";
    }
  }

  const appt = await db.appointment.create({
    data: {
      businessId: ctx.businessId,
      branchId: ctx.branchId,
      customerId: customer.id,
      staffId,
      startAt,
      durationMin: input.durationMin,
      service: input.service || null,
      note: input.note || null,
      createdById: ctx.user.id,
    },
  });

  // Nhắn xác nhận. Quán chưa ghép WhatsApp thì bỏ qua, lịch vẫn được lưu.
  await sendAppointmentWhatsApp({ appointmentId: appt.id, key: "appointment_confirmed" }).catch(
    () => undefined,
  );

  revalidatePath("/dashboard/appointments");
  return { ok: true, warning };
}

const statusSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["BOOKED", "CONFIRMED", "DONE", "NO_SHOW", "CANCELLED"]),
});

export async function setAppointmentStatus(formData: FormData) {
  const ctx = await requireBusinessContext();
  const parsed = statusSchema.safeParse({
    id: formData.get("id"),
    status: formData.get("status"),
  });
  if (!parsed.success) return;

  // where có businessId để không sửa được lịch của quán khác.
  const updated = await db.appointment.updateMany({
    where: { id: parsed.data.id, businessId: ctx.businessId },
    data: { status: parsed.data.status },
  });
  if (updated.count === 0) return;

  if (parsed.data.status === "CANCELLED") {
    await sendAppointmentWhatsApp({
      appointmentId: parsed.data.id,
      key: "appointment_cancelled",
    }).catch(() => undefined);
  }
  revalidatePath("/dashboard/appointments");
}
