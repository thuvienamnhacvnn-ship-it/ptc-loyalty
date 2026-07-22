import { NextResponse, type NextRequest } from "next/server";
import { requirePosContext, posError } from "@/lib/pos/context";
import { db } from "@/lib/db";

// GET /api/pos/whatsapp/messages?limit=50  — recent WhatsApp messages for the
// caller's business (most recent first). Auth: Bearer <POS access token>.
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requirePosContext(req);
  if (!auth.ok) {
    return NextResponse.json(posError(auth.error), { status: auth.status });
  }

  const limitRaw = Number(req.nextUrl.searchParams.get("limit") ?? 50);
  const limit = Math.min(Math.max(Number.isFinite(limitRaw) ? limitRaw : 50, 1), 100);

  const rows = await db.whatsAppMessageLog.findMany({
    where: { businessId: auth.ctx.businessId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      kind: true,
      status: true,
      direction: true,
      toPhone: true,
      fromPhone: true,
      language: true,
      providerMessageId: true,
      payloadSnapshot: true,
      error: true,
      customerId: true,
      createdAt: true,
      sentAt: true,
      deliveredAt: true,
      readAt: true,
      customer: { select: { firstName: true, lastName: true } },
    },
  });

  const messages = rows.map((m) => {
    const snap = (m.payloadSnapshot ?? {}) as {
      direction?: string;
      textBody?: string | null;
      preview?: string;
    };
    return {
      id: m.id,
      kind: m.kind,
      status: m.status,
      direction: (m.direction ?? snap.direction ?? "OUTBOUND").toUpperCase(),
      toPhone: m.toPhone,
      fromPhone: m.fromPhone,
      text: snap.textBody ?? snap.preview ?? "",
      customerId: m.customerId,
      customerName: m.customer
        ? [m.customer.firstName, m.customer.lastName].filter(Boolean).join(" ")
        : null,
      providerMessageId: m.providerMessageId,
      error: m.error,
      createdAt: m.createdAt,
      sentAt: m.sentAt,
      deliveredAt: m.deliveredAt,
      readAt: m.readAt,
    };
  });

  return NextResponse.json({ messages }, { headers: { "Cache-Control": "no-store" } });
}
