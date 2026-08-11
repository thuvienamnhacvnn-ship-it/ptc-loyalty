"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { db } from "@/lib/db";
import { contactNotificationEmailHtml, sendEmail } from "@/lib/email";

// Hòm thư nhận tin từ form Liên hệ. Đặt được qua env để đổi mà không phải build
// lại; mặc định là địa chỉ đang niêm yết trên ptc-creative.com.
const INBOX = process.env.CONTACT_EMAIL || "ptc.creative.vn@gmail.com";

// Chống spam: cùng một IP chỉ gửi được ngần này tin trong cửa sổ thời gian dưới.
const MAX_PER_WINDOW = 5;
const WINDOW_MINUTES = 15;

const schema = z.object({
  name: z.string().trim().min(2, "Tên quá ngắn").max(100, "Tên quá dài"),
  email: z.string().trim().email("Email không hợp lệ").max(200),
  message: z
    .string()
    .trim()
    .min(10, "Nội dung quá ngắn, hãy mô tả rõ hơn")
    .max(5000, "Nội dung quá dài (tối đa 5000 ký tự)"),
});

export interface ContactState {
  sent?: boolean;
  error?: string;
  fieldErrors?: Partial<Record<"name" | "email" | "message", string[]>>;
}

/** Lấy IP thật khi app chạy sau nginx của VPS. */
async function clientIp(): Promise<string | null> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim().slice(0, 45);
  return h.get("x-real-ip")?.slice(0, 45) ?? null;
}

export async function submitContactMessage(
  _prev: ContactState,
  formData: FormData,
): Promise<ContactState> {
  // Bẫy bot: trường ẩn, người thật không bao giờ điền. Im lặng báo thành công
  // để bot không biết mình bị chặn.
  if (String(formData.get("website") ?? "").trim() !== "") {
    return { sent: true };
  }

  const parsed = schema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    message: formData.get("message"),
  });
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const ip = await clientIp();
  const userAgent = (await headers()).get("user-agent")?.slice(0, 300) ?? null;

  if (ip) {
    const since = new Date(Date.now() - WINDOW_MINUTES * 60_000);
    const recent = await db.contactMessage.count({
      where: { ip, createdAt: { gte: since } },
    });
    if (recent >= MAX_PER_WINDOW) {
      return {
        error: `Bạn đã gửi quá nhiều tin. Vui lòng thử lại sau ${WINDOW_MINUTES} phút.`,
      };
    }
  }

  // Ghi vào DB TRƯỚC. Email có hỏng thì tin vẫn còn trong /admin/contact.
  const saved = await db.contactMessage.create({
    data: { ...parsed.data, ip, userAgent },
  });

  const base = process.env.NEXT_PUBLIC_APP_URL || "https://ptc-bonus.com";
  const result = await sendEmail({
    to: INBOX,
    replyTo: parsed.data.email,
    subject: `[PTC Bonus] Liên hệ mới từ ${parsed.data.name}`,
    html: contactNotificationEmailHtml({
      ...parsed.data,
      adminUrl: `${base}/admin/contact`,
    }),
    text: `${parsed.data.name} <${parsed.data.email}>\n\n${parsed.data.message}`,
  });

  await db.contactMessage.update({
    where: { id: saved.id },
    data: {
      emailSent: result.ok && !result.mocked,
      emailError: result.ok ? null : (result.error ?? "email_error").slice(0, 300),
    },
  });

  return { sent: true };
}
