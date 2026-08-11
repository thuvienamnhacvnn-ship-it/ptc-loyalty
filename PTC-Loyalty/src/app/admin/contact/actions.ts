"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/tenant";

const schema = z.object({
  id: z.string().min(1),
  status: z.enum(["NEW", "READ", "ARCHIVED"]),
});

/** Đổi trạng thái một tin liên hệ (đã đọc / lưu trữ). Chỉ super admin. */
export async function setContactMessageStatus(formData: FormData) {
  await requirePlatformAdmin();

  const parsed = schema.safeParse({
    id: formData.get("id"),
    status: formData.get("status"),
  });
  if (!parsed.success) return;

  await db.contactMessage.update({
    where: { id: parsed.data.id },
    data: { status: parsed.data.status },
  });
  revalidatePath("/admin/contact");
}
