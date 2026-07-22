"use server";

import crypto from "crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireBusinessContext } from "@/lib/tenant";
import { hasAtLeast } from "@/lib/rbac";
import { encryptSecret, isEncryptionConfigured } from "@/lib/crypto";
import { sendTestMessage } from "@/lib/whatsapp/service";
import { defaultTemplateRows, normalizeLanguage } from "@/lib/whatsapp/templates";

export interface FormResult {
  ok: boolean;
  error?: string;
}

/** Ensure the 3-language default templates exist for this business. Idempotent. */
async function ensureTemplates(businessId: string) {
  const rows = defaultTemplateRows();
  for (const r of rows) {
    await db.whatsAppTemplate.upsert({
      where: {
        businessId_key_language: {
          businessId,
          key: r.key,
          language: r.language,
        },
      },
      update: { bodyPreview: r.bodyPreview, category: r.category },
      create: {
        businessId,
        key: r.key,
        language: r.language,
        metaTemplateName: r.metaTemplateName,
        category: r.category,
        bodyPreview: r.bodyPreview,
      },
    });
  }
}

const connectionSchema = z.object({
  phoneNumberId: z.string().trim().min(1, "Nhập Phone Number ID"),
  wabaId: z.string().trim().min(1, "Nhập WhatsApp Business Account ID"),
  // Optional: only rotate the token when a new value is supplied.
  accessToken: z.string().trim().optional(),
  graphApiVersion: z.string().trim().optional(),
  defaultLanguage: z.enum(["vi", "de", "en"]),
});

export async function saveConnection(
  input: z.infer<typeof connectionSchema>,
): Promise<FormResult> {
  const ctx = await requireBusinessContext();
  if (!hasAtLeast(ctx.role, "BUSINESS_OWNER")) {
    return { ok: false, error: "Chỉ chủ doanh nghiệp mới được cấu hình WhatsApp." };
  }
  const parsed = connectionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message };
  const d = parsed.data;

  if (d.accessToken && !isEncryptionConfigured()) {
    return {
      ok: false,
      error: "Thiếu ENCRYPTION_KEY trên server — không thể mã hóa access token.",
    };
  }

  const existing = await db.whatsAppConnection.findUnique({
    where: { businessId: ctx.businessId },
  });

  // Encrypt the token if a new one was provided; otherwise keep the old cipher.
  const accessTokenCipher = d.accessToken
    ? encryptSecret(d.accessToken)
    : existing?.accessTokenCipher ?? null;

  const connected = !!accessTokenCipher && !!d.phoneNumberId;

  await db.whatsAppConnection.upsert({
    where: { businessId: ctx.businessId },
    update: {
      phoneNumberId: d.phoneNumberId,
      wabaId: d.wabaId,
      accessTokenCipher,
      graphApiVersion: d.graphApiVersion || "v21.0",
      defaultLanguage: d.defaultLanguage,
      status: connected ? "CONNECTED" : "DISCONNECTED",
      connectedAt: connected ? existing?.connectedAt ?? new Date() : null,
      lastError: null,
    },
    create: {
      businessId: ctx.businessId,
      phoneNumberId: d.phoneNumberId,
      wabaId: d.wabaId,
      accessTokenCipher,
      graphApiVersion: d.graphApiVersion || "v21.0",
      defaultLanguage: d.defaultLanguage,
      status: connected ? "CONNECTED" : "DISCONNECTED",
      connectedAt: connected ? new Date() : null,
    },
  });

  await ensureTemplates(ctx.businessId);

  await db.auditLog.create({
    data: {
      businessId: ctx.businessId,
      userId: ctx.user.id,
      action: "whatsapp.connection.save",
      entity: "WhatsAppConnection",
      entityId: ctx.businessId,
      metadata: { connected, tokenRotated: !!d.accessToken },
    },
  });

  revalidatePath("/dashboard/settings/whatsapp");
  return { ok: true };
}

const togglesSchema = z.object({
  notifyOnEarn: z.coerce.boolean().optional(),
  notifyOnRedeem: z.coerce.boolean().optional(),
  notifyOnVoucher: z.coerce.boolean().optional(),
});

export async function saveToggles(
  input: z.infer<typeof togglesSchema>,
): Promise<FormResult> {
  const ctx = await requireBusinessContext();
  if (!hasAtLeast(ctx.role, "BUSINESS_MANAGER")) {
    return { ok: false, error: "Không có quyền." };
  }
  const connection = await db.whatsAppConnection.findUnique({
    where: { businessId: ctx.businessId },
  });
  if (!connection) return { ok: false, error: "Chưa cấu hình WhatsApp." };

  await db.whatsAppConnection.update({
    where: { businessId: ctx.businessId },
    data: {
      notifyOnEarn: !!input.notifyOnEarn,
      notifyOnRedeem: !!input.notifyOnRedeem,
      notifyOnVoucher: !!input.notifyOnVoucher,
    },
  });
  revalidatePath("/dashboard/settings/whatsapp");
  return { ok: true };
}

const testSchema = z.object({
  phone: z.string().trim().min(5, "Nhập số điện thoại hợp lệ"),
  language: z.enum(["vi", "de", "en"]).optional(),
});

export async function sendTest(
  input: z.infer<typeof testSchema>,
): Promise<FormResult> {
  const ctx = await requireBusinessContext();
  if (!hasAtLeast(ctx.role, "BUSINESS_MANAGER")) {
    return { ok: false, error: "Không có quyền." };
  }
  const parsed = testSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message };

  const [connection, business] = await Promise.all([
    db.whatsAppConnection.findUnique({ where: { businessId: ctx.businessId } }),
    db.business.findUnique({ where: { id: ctx.businessId }, select: { name: true } }),
  ]);
  if (!connection || connection.status !== "CONNECTED") {
    return { ok: false, error: "WhatsApp chưa được kết nối." };
  }

  await sendTestMessage({
    businessId: ctx.businessId,
    toPhone: parsed.data.phone,
    language: normalizeLanguage(parsed.data.language ?? connection.defaultLanguage),
    storeName: business?.name ?? "PTC Loyalty",
    nonce: crypto.randomUUID(),
  });

  revalidatePath("/dashboard/settings/whatsapp");
  return { ok: true };
}

export async function disconnect(): Promise<FormResult> {
  const ctx = await requireBusinessContext();
  if (!hasAtLeast(ctx.role, "BUSINESS_OWNER")) {
    return { ok: false, error: "Không có quyền." };
  }
  await db.whatsAppConnection.updateMany({
    where: { businessId: ctx.businessId },
    data: { status: "DISCONNECTED", accessTokenCipher: null, connectedAt: null },
  });
  await db.auditLog.create({
    data: {
      businessId: ctx.businessId,
      userId: ctx.user.id,
      action: "whatsapp.connection.disconnect",
      entity: "WhatsAppConnection",
      entityId: ctx.businessId,
    },
  });
  revalidatePath("/dashboard/settings/whatsapp");
  return { ok: true };
}
