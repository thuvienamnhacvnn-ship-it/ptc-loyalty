// TEMPORARY, key-guarded admin endpoint to register a WhatsApp Cloud API phone
// number (fixes the "Pending / Please register this phone number using the
// registration API" state). The access token and the two-step PIN are read from
// server env and are NEVER returned in the response or written to any log.
//
//   GET /api/admin/wa-register?key=<WHATSAPP_ADMIN_KEY>&pnid=<PHONE_NUMBER_ID>
//        → diagnostics only: number status + WABA + template status
//   GET /api/admin/wa-register?key=...&pnid=...&action=register
//        → also POST /{pnid}/register with { messaging_product, pin } and re-check
//
// Delete this route once the number is Registered.

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const GRAPH = "https://graph.facebook.com/v21.0";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);

  // ── Guard: a shared admin key that only the operator knows. ────────────────
  const adminKey = process.env.WHATSAPP_ADMIN_KEY;
  if (!adminKey || url.searchParams.get("key") !== adminKey) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const pnid = url.searchParams.get("pnid") || process.env.WHATSAPP_PHONE_NUMBER_ID;
  const wabaId = process.env.WHATSAPP_WABA_ID || "1014775701528488";
  const pin = process.env.WHATSAPP_REGISTER_PIN;

  if (!token) return NextResponse.json({ ok: false, error: "missing WHATSAPP_ACCESS_TOKEN" });
  if (!pnid) return NextResponse.json({ ok: false, error: "missing phone number id (pnid)" });

  const auth = { Authorization: `Bearer ${token}` };
  const out: Record<string, unknown> = { pnid, wabaId, tokenPresent: true, pinPresent: !!pin };

  // 1) Phone number info — status / verified name / which WABA it belongs to.
  try {
    const r = await fetch(
      `${GRAPH}/${pnid}?fields=id,display_phone_number,verified_name,status,name_status,code_verification_status,quality_rating,platform_type`,
      { headers: auth },
    );
    out.numberInfo = { httpStatus: r.status, body: await r.json().catch(() => ({})) };
  } catch (e) {
    out.numberInfo = { error: e instanceof Error ? e.message : "fetch_failed" };
  }

  // 2) Confirm the phone number id really lives under the expected WABA.
  try {
    const r = await fetch(`${GRAPH}/${wabaId}/phone_numbers?fields=id,display_phone_number,status`, {
      headers: auth,
    });
    const j: { data?: Array<{ id: string; display_phone_number: string; status: string }> } =
      await r.json().catch(() => ({}));
    out.wabaPhoneNumbers = Array.isArray(j.data)
      ? j.data.map((p) => ({ id: p.id, number: p.display_phone_number, status: p.status }))
      : j;
    out.pnidBelongsToWaba = Array.isArray(j.data) ? j.data.some((p) => p.id === pnid) : null;
  } catch (e) {
    out.wabaPhoneNumbers = { error: e instanceof Error ? e.message : "fetch_failed" };
  }

  // 3) Template status (name + language + APPROVED?).
  try {
    const r = await fetch(`${GRAPH}/${wabaId}/message_templates?name=ptc_member_card&limit=10`, {
      headers: auth,
    });
    const j: { data?: Array<{ name: string; language: string; status: string }> } = await r
      .json()
      .catch(() => ({}));
    out.template = Array.isArray(j.data)
      ? j.data.map((t) => ({ name: t.name, language: t.language, status: t.status }))
      : j;
  } catch (e) {
    out.template = { error: e instanceof Error ? e.message : "fetch_failed" };
  }

  // 4) Registration — only when explicitly asked, so diagnostics stay side-effect free.
  if (url.searchParams.get("action") === "register") {
    if (!pin) {
      out.register = { error: "missing WHATSAPP_REGISTER_PIN (set a 6-digit PIN in env)" };
    } else {
      try {
        const r = await fetch(`${GRAPH}/${pnid}/register`, {
          method: "POST",
          headers: { ...auth, "Content-Type": "application/json" },
          body: JSON.stringify({ messaging_product: "whatsapp", pin }),
        });
        // Body may contain { success: true } or an { error: { code, message } }.
        out.register = { httpStatus: r.status, body: await r.json().catch(() => ({})) };
      } catch (e) {
        out.register = { error: e instanceof Error ? e.message : "fetch_failed" };
      }
      // Re-check status right after registering.
      try {
        const r = await fetch(`${GRAPH}/${pnid}?fields=status,name_status,code_verification_status`, {
          headers: auth,
        });
        out.numberInfoAfter = { httpStatus: r.status, body: await r.json().catch(() => ({})) };
      } catch (e) {
        out.numberInfoAfter = { error: e instanceof Error ? e.message : "fetch_failed" };
      }
    }
  }

  return NextResponse.json({ ok: true, ...out });
}
