import { db } from "@/lib/db";
import { normalizePhone } from "@/lib/whatsapp/client";

export interface InboundMessage {
  phoneNumberId?: string; // Meta phone_number_id (identifies the business inbox)
  fromPhone: string; // customer's number (E.164 digits)
  text: string;
  wamid: string; // Meta message id — used for idempotency
  timestamp?: number; // unix seconds
}

/**
 * Persist an inbound WhatsApp message, tenant-scoped. Resolution order:
 *  1) Meta phone_number_id → WhatsAppConnection → businessId (multi-tenant).
 *  2) Fallback (single env-token setup, no connection row): match the sender's
 *     phone to a CustomerProfile and use that customer's business.
 * Dedupes on (businessId, wamid). Never throws to the caller.
 */
export async function persistInboundMessage(msg: InboundMessage): Promise<void> {
  if (!msg.wamid || !msg.fromPhone) return;

  let businessId: string | null = null;
  let toPhone = msg.phoneNumberId ?? "";

  if (msg.phoneNumberId) {
    const conn = await db.whatsAppConnection.findFirst({
      where: { phoneNumberId: msg.phoneNumberId },
      select: { businessId: true, displayPhoneNumber: true },
    });
    if (conn) {
      businessId = conn.businessId;
      toPhone = conn.displayPhoneNumber ?? toPhone;
    }
  }

  // Match the sender to a customer (last 8 digits → tolerant of +/country code).
  const digits = normalizePhone(msg.fromPhone);
  const tail = digits.slice(-8);
  const customer = tail
    ? await db.customerProfile.findFirst({
        where: {
          ...(businessId ? { businessId } : {}),
          phone: { contains: tail },
        },
        select: { id: true, businessId: true },
        orderBy: { lastVisitAt: "desc" },
      })
    : null;

  if (!businessId && customer) businessId = customer.businessId;
  if (!businessId) return; // cannot attribute to a tenant — drop safely

  const when = msg.timestamp ? new Date(msg.timestamp * 1000) : new Date();

  try {
    await db.whatsAppMessageLog.upsert({
      where: { businessId_idempotencyKey: { businessId, idempotencyKey: msg.wamid } },
      update: {}, // already stored — idempotent no-op
      create: {
        businessId,
        customerId: customer?.id ?? null,
        kind: "INBOUND",
        direction: "INBOUND",
        status: "DELIVERED",
        toPhone,
        fromPhone: msg.fromPhone,
        idempotencyKey: msg.wamid,
        providerMessageId: msg.wamid,
        payloadSnapshot: { direction: "inbound", textBody: msg.text, preview: msg.text },
        deliveredAt: when,
      },
    });
  } catch (e) {
    console.error("[whatsapp-inbound] persist failed:", e instanceof Error ? e.message : e);
  }
}
