// TEMPORARY, key-guarded: verify automatic Cloud API delivery after linking the
// WABA payment method. Token read from env, never returned/logged. Delete after.
//   GET ?key=..&test=<digits>  → send ptc_welcome template + log wamid
//   GET ?key=..&logs=1         → read back delivery status (updated by webhook)
import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import { db } from "@/lib/db";

export const runtime = "nodejs";
const GRAPH = "https://graph.facebook.com/v21.0";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  if (url.searchParams.get("key") !== process.env.WHATSAPP_ADMIN_KEY) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const token = process.env.WHATSAPP_ACCESS_TOKEN!;
  const pnid = process.env.WHATSAPP_PHONE_NUMBER_ID!;
  const name = process.env.WHATSAPP_MEMBER_TEMPLATE || "ptc_welcome";
  const lang = process.env.WHATSAPP_MEMBER_TEMPLATE_LANG || "vi";
  const auth = { Authorization: `Bearer ${token}` };
  const out: Record<string, unknown> = {};

  const test = url.searchParams.get("test");
  if (test) {
    const to = test.replace(/[^\d]/g, "");
    const png = await QRCode.toBuffer("https://ptc-loyalty.com", { width: 512, margin: 2 });
    const form = new FormData();
    form.append("messaging_product", "whatsapp");
    form.append("type", "image/png");
    form.append("file", new Blob([png as BlobPart], { type: "image/png" }), "qr.png");
    const up = await fetch(`${GRAPH}/${pnid}/media`, { method: "POST", headers: auth, body: form });
    const upJson: { id?: string } = await up.json().catch(() => ({}));
    if (upJson.id) {
      const send = await fetch(`${GRAPH}/${pnid}/messages`, {
        method: "POST",
        headers: { ...auth, "Content-Type": "application/json" },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to,
          type: "template",
          template: {
            name,
            language: { code: lang },
            components: [
              { type: "header", parameters: [{ type: "image", image: { id: upJson.id } }] },
              {
                type: "body",
                parameters: [
                  { type: "text", parameter_name: "customer_name", text: "Test User" },
                  { type: "text", parameter_name: "member_code", text: "TV000999" },
                ],
              },
            ],
          },
        }),
      });
      const sendJson: { messages?: { id: string }[]; error?: unknown } = await send
        .json()
        .catch(() => ({}));
      out.testSend = { httpStatus: send.status, body: sendJson };
      const wamid = sendJson.messages?.[0]?.id;
      if (wamid) {
        const biz = await db.business.findFirst({ select: { id: true } });
        if (biz) {
          await db.whatsAppMessageLog.create({
            data: {
              businessId: biz.id,
              kind: "TEST",
              status: "SENT",
              direction: "OUTBOUND",
              toPhone: to,
              language: lang,
              templateKey: name,
              idempotencyKey: `wa-verify:${wamid}`,
              providerMessageId: wamid,
              sentAt: new Date(),
            },
          });
        }
      }
    } else {
      out.testSend = { error: "media upload failed" };
    }
  }

  if (url.searchParams.get("logs") === "1") {
    out.logs = await db.whatsAppMessageLog.findMany({
      where: { idempotencyKey: { startsWith: "wa-verify:" } },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        toPhone: true, status: true, error: true,
        sentAt: true, deliveredAt: true, readAt: true, failedAt: true,
      },
    });
  }

  return NextResponse.json({ ok: true, ...out });
}
