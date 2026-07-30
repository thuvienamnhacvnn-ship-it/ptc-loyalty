"use server";

import crypto from "crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireBusinessContext } from "@/lib/tenant";
import { hasAtLeast } from "@/lib/rbac";
import {
  disconnectConnection,
  getOrCreateConnection,
  refreshConnection,
  startConnection,
  type ConnectionView,
} from "@/lib/whatsapp/connection";
import { sendTestMessage } from "@/lib/whatsapp/service";
import { defaultTemplateRows, normalizeLanguage } from "@/lib/whatsapp/templates";

export interface FormResult {
  ok: boolean;
  error?: string;
}

export type ConnectionResult =
  | { ok: true; connection: ConnectionView }
  | { ok: false; error: string };

/** Ensure the default message copy exists for this business. Idempotent. */
async function ensureTemplates(businessId: string) {
  for (const r of defaultTemplateRows()) {
    await db.whatsAppTemplate.upsert({
      where: {
        businessId_key_language: { businessId, key: r.key, language: r.language },
      },
      update: {},
      create: { businessId, key: r.key, language: r.language, body: r.body },
    });
  }
}

/**
 * Step 1 of pairing: ask the provider for a WhatsApp Web login QR. The owner
 * scans it with the phone that holds the restaurant's number — after that every
 * message to customers comes from that number.
 */
export async function connectWhatsApp(): Promise<ConnectionResult> {
  const ctx = await requireBusinessContext();
  if (!hasAtLeast(ctx.role, "BUSINESS_OWNER")) {
    return { ok: false, error: "Chỉ chủ doanh nghiệp mới được kết nối WhatsApp." };
  }

  await getOrCreateConnection(ctx.businessId);
  await ensureTemplates(ctx.businessId);
  const connection = await startConnection(ctx.businessId);

  await db.auditLog.create({
    data: {
      businessId: ctx.businessId,
      userId: ctx.user.id,
      action: "whatsapp.connection.start",
      entity: "WhatsAppConnection",
      entityId: ctx.businessId,
      metadata: { provider: connection.providerId, status: connection.status },
    },
  });

  revalidatePath("/dashboard/settings/whatsapp");
  return { ok: true, connection };
}

/** Polled by the settings page while the QR is on screen. */
export async function pollConnection(): Promise<ConnectionResult> {
  const ctx = await requireBusinessContext();
  if (!hasAtLeast(ctx.role, "BUSINESS_MANAGER")) {
    return { ok: false, error: "Không có quyền." };
  }
  return { ok: true, connection: await refreshConnection(ctx.businessId) };
}

export async function disconnect(): Promise<FormResult> {
  const ctx = await requireBusinessContext();
  if (!hasAtLeast(ctx.role, "BUSINESS_OWNER")) {
    return { ok: false, error: "Không có quyền." };
  }
  await disconnectConnection(ctx.businessId);
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

const settingsSchema = z.object({
  defaultLanguage: z.enum(["vi", "de", "en"]),
  notifyOnSignup: z.coerce.boolean().optional(),
  notifyOnEarn: z.coerce.boolean().optional(),
  notifyOnRedeem: z.coerce.boolean().optional(),
  notifyOnVoucher: z.coerce.boolean().optional(),
});

export async function saveSettings(
  input: z.infer<typeof settingsSchema>,
): Promise<FormResult> {
  const ctx = await requireBusinessContext();
  if (!hasAtLeast(ctx.role, "BUSINESS_MANAGER")) {
    return { ok: false, error: "Không có quyền." };
  }
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message };
  const d = parsed.data;

  await getOrCreateConnection(ctx.businessId);
  await db.whatsAppConnection.update({
    where: { businessId: ctx.businessId },
    data: {
      defaultLanguage: d.defaultLanguage,
      notifyOnSignup: !!d.notifyOnSignup,
      notifyOnEarn: !!d.notifyOnEarn,
      notifyOnRedeem: !!d.notifyOnRedeem,
      notifyOnVoucher: !!d.notifyOnVoucher,
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
    storeName: business?.name ?? "PTC-BONUS",
    nonce: crypto.randomUUID(),
  });

  revalidatePath("/dashboard/settings/whatsapp");
  return { ok: true };
}
