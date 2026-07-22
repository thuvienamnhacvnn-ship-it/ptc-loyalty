import { db } from "@/lib/db";
import { decryptSecret } from "@/lib/crypto";
import { enqueue, registerJob } from "@/lib/jobs/queue";
import {
  sendTemplateMessage,
  sendTextMessage,
  type WhatsAppCredentials,
} from "./client";
import {
  DEFAULT_META_TEMPLATE_NAME,
  META_LOCALE,
  normalizeLanguage,
  progressLine,
  renderBody,
  templateBody,
  type TemplateKey,
  type WaLanguage,
} from "./templates";
import type { Prisma } from "@prisma/client";

const SEND_JOB = "wa:send";

function memberUrl(): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return `${base.replace(/\/$/, "")}/member`;
}

interface Eligibility {
  eligible: boolean;
  reason?: string;
  phone?: string;
  language?: WaLanguage;
}

/**
 * Resolve whether a transactional WhatsApp can be sent to a customer:
 * business connected + event toggle on + customer transactional consent + phone.
 * Fully tenant-scoped.
 */
async function resolveTransactionalEligibility(
  businessId: string,
  customerId: string,
  toggle: "notifyOnEarn" | "notifyOnRedeem" | "notifyOnVoucher",
): Promise<Eligibility> {
  const [connection, customer, consent] = await Promise.all([
    db.whatsAppConnection.findUnique({ where: { businessId } }),
    db.customerProfile.findUnique({ where: { id: customerId } }),
    db.customerCommunicationConsent.findUnique({ where: { customerId } }),
  ]);

  if (!customer || customer.businessId !== businessId) {
    return { eligible: false, reason: "customer_not_found" };
  }
  if (!connection || connection.status !== "CONNECTED") {
    return { eligible: false, reason: "not_connected" };
  }
  if (!connection[toggle]) {
    return { eligible: false, reason: "toggle_off" };
  }
  if (!consent?.whatsappTransactional) {
    return { eligible: false, reason: "no_consent" };
  }
  const phone = consent.whatsappPhone || customer.phone;
  if (!phone) {
    return { eligible: false, reason: "no_phone" };
  }
  return {
    eligible: true,
    phone,
    language: normalizeLanguage(customer.locale),
  };
}

/** Compute the "points needed" progress line for a customer after earning. */
async function computeProgress(
  businessId: string,
  language: WaLanguage,
  balanceAfter: number,
  totalEarned: number,
): Promise<string> {
  const [nextReward, nextTier] = await Promise.all([
    db.reward.findFirst({
      where: { businessId, status: "ACTIVE", pointsCost: { gt: balanceAfter } },
      orderBy: { pointsCost: "asc" },
    }),
    db.membershipTier.findFirst({
      where: { businessId, minPoints: { gt: totalEarned } },
      orderBy: { minPoints: "asc" },
    }),
  ]);

  const rewardGap = nextReward ? nextReward.pointsCost - balanceAfter : Infinity;
  const tierGap = nextTier ? nextTier.minPoints - totalEarned : Infinity;

  if (rewardGap === Infinity && tierGap === Infinity) {
    return progressLine(language, { kind: "max" });
  }
  if (rewardGap <= tierGap && nextReward) {
    return progressLine(language, { kind: "reward", points: rewardGap, label: nextReward.name });
  }
  return progressLine(language, { kind: "tier", points: tierGap, label: nextTier!.name });
}

interface QueueArgs {
  businessId: string;
  customerId: string | null;
  kind: "POINTS_EARNED" | "REWARD_REDEEMED" | "VOUCHER" | "TEST";
  templateKey: TemplateKey | null;
  language: WaLanguage;
  toPhone: string;
  idempotencyKey: string;
  transactionId?: string | null;
  // What to actually send:
  bodyParams?: string[]; // for template messages
  textBody?: string; // for TEST / text messages
  previewBody: string; // human-readable snapshot
}

/**
 * Create (or reuse) a message log and schedule delivery. Idempotent via the
 * unique (businessId, idempotencyKey) constraint. Never throws to the caller.
 */
async function queueMessage(args: QueueArgs): Promise<void> {
  try {
    const existing = await db.whatsAppMessageLog.findUnique({
      where: {
        businessId_idempotencyKey: {
          businessId: args.businessId,
          idempotencyKey: args.idempotencyKey,
        },
      },
    });
    if (existing) return; // already queued/sent — do not duplicate

    const snapshot: Prisma.InputJsonValue = {
      bodyParams: args.bodyParams ?? [],
      textBody: args.textBody ?? null,
      preview: args.previewBody,
    };

    const log = await db.whatsAppMessageLog.create({
      data: {
        businessId: args.businessId,
        customerId: args.customerId,
        kind: args.kind,
        status: "QUEUED",
        toPhone: args.toPhone,
        language: args.language,
        templateKey: args.templateKey,
        idempotencyKey: args.idempotencyKey,
        transactionId: args.transactionId ?? null,
        payloadSnapshot: snapshot,
      },
    });

    enqueue(SEND_JOB, { logId: log.id, businessId: args.businessId });
  } catch (err) {
    // A unique-violation race is fine (another path queued it first).
    // eslint-disable-next-line no-console
    console.error("[whatsapp] queueMessage failed:", err instanceof Error ? err.message : err);
  }
}

// ── Public API used by the transaction engine & UI ───────────────────────────

export async function notifyPointsEarned(input: {
  businessId: string;
  customerId: string;
  transactionId: string;
  points: number;
  balanceAfter: number;
  totalEarned: number;
  storeName: string;
}): Promise<void> {
  const elig = await resolveTransactionalEligibility(
    input.businessId,
    input.customerId,
    "notifyOnEarn",
  );
  if (!elig.eligible || !elig.phone || !elig.language) return;

  const progress = await computeProgress(
    input.businessId,
    elig.language,
    input.balanceAfter,
    input.totalEarned,
  );
  const params = [
    input.storeName,
    String(input.points),
    String(input.balanceAfter),
    progress,
    memberUrl(),
  ];
  await queueMessage({
    businessId: input.businessId,
    customerId: input.customerId,
    kind: "POINTS_EARNED",
    templateKey: "points_earned",
    language: elig.language,
    toPhone: elig.phone,
    idempotencyKey: `earn:${input.transactionId}`,
    transactionId: input.transactionId,
    bodyParams: params,
    previewBody: renderBody("points_earned", elig.language, params),
  });
}

export async function notifyRewardRedeemed(input: {
  businessId: string;
  customerId: string;
  transactionId: string;
  pointsSpent: number;
  balanceAfter: number;
  storeName: string;
}): Promise<void> {
  const elig = await resolveTransactionalEligibility(
    input.businessId,
    input.customerId,
    "notifyOnRedeem",
  );
  if (!elig.eligible || !elig.phone || !elig.language) return;

  const params = [
    input.storeName,
    String(input.pointsSpent),
    String(input.balanceAfter),
    memberUrl(),
  ];
  await queueMessage({
    businessId: input.businessId,
    customerId: input.customerId,
    kind: "REWARD_REDEEMED",
    templateKey: "reward_redeemed",
    language: elig.language,
    toPhone: elig.phone,
    idempotencyKey: `redeem:${input.transactionId}`,
    transactionId: input.transactionId,
    bodyParams: params,
    previewBody: renderBody("reward_redeemed", elig.language, params),
  });
}

export async function notifyVoucherIssued(input: {
  businessId: string;
  customerId: string;
  customerVoucherId: string;
  voucherTitle: string;
  storeName: string;
}): Promise<void> {
  const elig = await resolveTransactionalEligibility(
    input.businessId,
    input.customerId,
    "notifyOnVoucher",
  );
  if (!elig.eligible || !elig.phone || !elig.language) return;

  const params = [input.storeName, input.voucherTitle, memberUrl()];
  await queueMessage({
    businessId: input.businessId,
    customerId: input.customerId,
    kind: "VOUCHER",
    templateKey: "voucher",
    language: elig.language,
    toPhone: elig.phone,
    idempotencyKey: `voucher:${input.customerVoucherId}`,
    bodyParams: params,
    previewBody: renderBody("voucher", elig.language, params),
  });
}

/** Owner-triggered test message (plain text, requires an open 24h window). */
export async function sendTestMessage(input: {
  businessId: string;
  toPhone: string;
  language: WaLanguage;
  storeName: string;
  nonce: string;
}): Promise<void> {
  const text = {
    vi: `✅ ${input.storeName}: Kết nối WhatsApp thành công! Đây là tin nhắn thử từ PTC Loyalty.`,
    de: `✅ ${input.storeName}: WhatsApp erfolgreich verbunden! Dies ist eine Testnachricht von PTC Loyalty.`,
    en: `✅ ${input.storeName}: WhatsApp connected! This is a test message from PTC Loyalty.`,
  }[input.language];

  await queueMessage({
    businessId: input.businessId,
    customerId: null,
    kind: "TEST",
    templateKey: null,
    language: input.language,
    toPhone: input.toPhone,
    idempotencyKey: `test:${input.nonce}`,
    textBody: text,
    previewBody: text,
  });
}

// ── Delivery job ─────────────────────────────────────────────────────────────

interface SendJobPayload {
  logId: string;
  businessId: string;
}

async function loadCredentials(businessId: string): Promise<WhatsAppCredentials | null> {
  const conn = await db.whatsAppConnection.findUnique({ where: { businessId } });
  if (!conn || !conn.accessTokenCipher || !conn.phoneNumberId) return null;
  let accessToken: string;
  try {
    accessToken = decryptSecret(conn.accessTokenCipher);
  } catch {
    return null;
  }
  return { accessToken, phoneNumberId: conn.phoneNumberId, apiVersion: conn.graphApiVersion };
}

registerJob<SendJobPayload>(
  SEND_JOB,
  async ({ logId, businessId }, ctx) => {
    const log = await db.whatsAppMessageLog.findUnique({ where: { id: logId } });
    if (!log || log.businessId !== businessId) return; // tenant guard
    if (log.status === "SENT" || log.status === "DELIVERED" || log.status === "READ") {
      return; // already delivered — idempotent no-op
    }
    if (log.providerMessageId) return; // already accepted by Meta

    const creds = await loadCredentials(businessId);
    if (!creds) {
      await db.whatsAppMessageLog.update({
        where: { id: logId },
        data: { status: "FAILED", error: "no_credentials", attempts: ctx.attempt, failedAt: new Date() },
      });
      return; // not retriable
    }

    const snapshot = (log.payloadSnapshot ?? {}) as {
      bodyParams?: string[];
      textBody?: string | null;
    };

    let result;
    if (log.kind === "TEST" || !log.templateKey) {
      result = await sendTextMessage(creds, log.toPhone, snapshot.textBody ?? "");
    } else {
      const template = await db.whatsAppTemplate.findUnique({
        where: {
          businessId_key_language: {
            businessId,
            key: log.templateKey,
            language: log.language,
          },
        },
      });
      const templateName =
        template?.metaTemplateName ??
        DEFAULT_META_TEMPLATE_NAME[log.templateKey as TemplateKey];
      result = await sendTemplateMessage(
        creds,
        log.toPhone,
        templateName,
        META_LOCALE[log.language as WaLanguage] ?? "en",
        snapshot.bodyParams ?? [],
      );
    }

    if (result.ok) {
      await db.whatsAppMessageLog.update({
        where: { id: logId },
        data: {
          status: "SENT",
          providerMessageId: result.messageId,
          sentAt: new Date(),
          attempts: ctx.attempt,
          error: null,
        },
      });
      return;
    }

    // Record the attempt, then decide whether to let the queue retry.
    await db.whatsAppMessageLog.update({
      where: { id: logId },
      data: {
        status: "FAILED",
        error: result.error,
        attempts: ctx.attempt,
        failedAt: new Date(),
      },
    });
    if (result.retriable && ctx.attempt < ctx.maxAttempts) {
      throw new Error(result.error); // trigger a retry
    }
  },
  { maxAttempts: 3, backoffMs: 1500 },
);

// Preview helper for the settings UI (no send).
export function previewTemplate(key: TemplateKey, language: WaLanguage): string {
  return templateBody(key, language);
}
