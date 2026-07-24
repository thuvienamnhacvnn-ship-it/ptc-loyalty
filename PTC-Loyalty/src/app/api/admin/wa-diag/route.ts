// TEMPORARY, key-guarded diagnostics for WhatsApp delivery problems.
// Access token is read from env and never returned/logged.
//   GET /api/admin/wa-diag?key=<WHATSAPP_ADMIN_KEY>
//        → phone-number health + WABA webhook subscription + template status
//   GET ...&test=<E164 number, digits only>
//        → also send the ptc_welcome template to that number and return the
//          full Graph API response (so we can see any delivery-blocking error)
// Delete once diagnosed.

import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";

export const runtime = "nodejs";
const GRAPH = "https://graph.facebook.com/v21.0";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const adminKey = process.env.WHATSAPP_ADMIN_KEY;
  if (!adminKey || url.searchParams.get("key") !== adminKey) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const token = process.env.WHATSAPP_ACCESS_TOKEN!;
  const pnid = process.env.WHATSAPP_PHONE_NUMBER_ID!;
  const wabaId = process.env.WHATSAPP_WABA_ID || "1014775701528488";
  const templateName = process.env.WHATSAPP_MEMBER_TEMPLATE || "ptc_welcome";
  const templateLang = process.env.WHATSAPP_MEMBER_TEMPLATE_LANG || "vi";
  const auth = { Authorization: `Bearer ${token}` };
  const out: Record<string, unknown> = { pnid, wabaId, templateName, templateLang };

  // 1) Phone number health (status / quality / throughput / messaging limit).
  try {
    const r = await fetch(
      `${GRAPH}/${pnid}?fields=display_phone_number,status,quality_rating,throughput,messaging_limit_tier,code_verification_status,platform_type`,
      { headers: auth },
    );
    out.numberHealth = { httpStatus: r.status, body: await r.json().catch(() => ({})) };
  } catch (e) {
    out.numberHealth = { error: e instanceof Error ? e.message : "fetch_failed" };
  }

  // 2) Is the app subscribed to this WABA's webhooks? (No subscription = no
  //    delivery/status callbacks, and templates may still send but we're blind.)
  //    With ?subscribe=1, POST to subscribe the app first, then re-read.
  if (url.searchParams.get("subscribe") === "1") {
    try {
      const r = await fetch(`${GRAPH}/${wabaId}/subscribed_apps`, { method: "POST", headers: auth });
      out.subscribeResult = { httpStatus: r.status, body: await r.json().catch(() => ({})) };
    } catch (e) {
      out.subscribeResult = { error: e instanceof Error ? e.message : "fetch_failed" };
    }
  }
  try {
    const r = await fetch(`${GRAPH}/${wabaId}/subscribed_apps`, { headers: auth });
    out.subscribedApps = { httpStatus: r.status, body: await r.json().catch(() => ({})) };
  } catch (e) {
    out.subscribedApps = { error: e instanceof Error ? e.message : "fetch_failed" };
  }

  // 3) Template status.
  try {
    const r = await fetch(
      `${GRAPH}/${wabaId}/message_templates?name=${encodeURIComponent(templateName)}&limit=10`,
      { headers: auth },
    );
    const j: { data?: Array<{ name: string; language: string; status: string; category: string }> } =
      await r.json().catch(() => ({}));
    out.template = Array.isArray(j.data)
      ? j.data.map((t) => ({ name: t.name, language: t.language, status: t.status, category: t.category }))
      : j;
  } catch (e) {
    out.template = { error: e instanceof Error ? e.message : "fetch_failed" };
  }

  // 4) Optional: actually send the template to a test number and return the raw
  //    Graph response, so any delivery-blocking error surfaces immediately.
  const test = url.searchParams.get("test");
  if (test) {
    const to = test.replace(/[^\d]/g, "");
    try {
      // Upload a QR image for the header (same path the real send uses).
      const png = await QRCode.toBuffer("https://ptc-loyalty.com", { width: 512, margin: 2 });
      const form = new FormData();
      form.append("messaging_product", "whatsapp");
      form.append("type", "image/png");
      form.append("file", new Blob([png as BlobPart], { type: "image/png" }), "qr.png");
      const up = await fetch(`${GRAPH}/${pnid}/media`, { method: "POST", headers: auth, body: form });
      const upJson: { id?: string; error?: unknown } = await up.json().catch(() => ({}));
      out.mediaUpload = { httpStatus: up.status, id: upJson.id ?? null, error: upJson.error ?? null };

      if (upJson.id) {
        const body = {
          messaging_product: "whatsapp",
          to,
          type: "template",
          template: {
            name: templateName,
            language: { code: templateLang },
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
        };
        const send = await fetch(`${GRAPH}/${pnid}/messages`, {
          method: "POST",
          headers: { ...auth, "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        out.testSend = { httpStatus: send.status, body: await send.json().catch(() => ({})) };
      }
    } catch (e) {
      out.testSend = { error: e instanceof Error ? e.message : "send_failed" };
    }
  }

  return NextResponse.json({ ok: true, ...out });
}
