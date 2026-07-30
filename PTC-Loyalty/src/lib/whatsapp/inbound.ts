import { db } from "@/lib/db";
import { toWhatsAppNumber } from "@/lib/phone";

export interface InboundMessage {
  /** Tenant is known from the per-business webhook URL. */
  businessId: string;
  /** Customer's number as reported by the provider. */
  fromPhone: string;
  text: string;
  /** Provider message id — used for idempotency. */
  messageId: string;
  /** Unix seconds. */
  timestamp?: number;
}

/**
 * Persist an inbound WhatsApp message, tenant-scoped. The sender is matched to a
 * CustomerProfile by the last 8 digits (tolerant of +/country-code formatting).
 * Dedupes on (businessId, messageId). Never throws to the caller.
 */
export async function persistInboundMessage(msg: InboundMessage): Promise<void> {
  if (!msg.businessId || !msg.messageId || !msg.fromPhone) return;

  const connection = await db.whatsAppConnection.findUnique({
    where: { businessId: msg.businessId },
    select: { displayPhoneNumber: true },
  });

  const digits = toWhatsAppNumber(msg.fromPhone) ?? msg.fromPhone.replace(/\D/g, "");
  const tail = digits.slice(-8);
  const customer = tail
    ? await db.customerProfile.findFirst({
        where: { businessId: msg.businessId, phone: { contains: tail } },
        select: { id: true },
        orderBy: { lastVisitAt: "desc" },
      })
    : null;

  const when = msg.timestamp ? new Date(msg.timestamp * 1000) : new Date();

  try {
    await db.whatsAppMessageLog.upsert({
      where: {
        businessId_idempotencyKey: {
          businessId: msg.businessId,
          idempotencyKey: msg.messageId,
        },
      },
      update: {}, // already stored — idempotent no-op
      create: {
        businessId: msg.businessId,
        customerId: customer?.id ?? null,
        kind: "INBOUND",
        direction: "INBOUND",
        status: "DELIVERED",
        toPhone: connection?.displayPhoneNumber ?? "",
        fromPhone: digits,
        idempotencyKey: msg.messageId,
        providerMessageId: msg.messageId,
        payloadSnapshot: { direction: "inbound", textBody: msg.text, preview: msg.text },
        deliveredAt: when,
      },
    });
  } catch (e) {
    console.error("[whatsapp-inbound] persist failed:", e instanceof Error ? e.message : e);
  }
}
