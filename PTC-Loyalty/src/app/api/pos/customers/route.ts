import { NextResponse, type NextRequest } from "next/server";
import { requirePosContext, posError } from "@/lib/pos/context";
import { createPosCustomer } from "@/lib/pos/service";
import { renderMemberQrPng } from "@/lib/member-qr";
import { sendMemberCardWhatsApp } from "@/lib/whatsapp/membership-card";

// POST /api/pos/customers — create a customer from the desktop client and
// return the new PosCustomer + its fixed membership QR (token + PNG data URL).
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const auth = await requirePosContext(req);
  if (!auth.ok) {
    return NextResponse.json(posError(auth.error), { status: auth.status });
  }

  let body: {
    firstName?: unknown;
    lastName?: unknown;
    phone?: unknown;
    email?: unknown;
    birthDate?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(posError("bad_request"), { status: 400 });
  }

  const firstName = typeof body.firstName === "string" ? body.firstName : "";
  if (!firstName.trim()) {
    return NextResponse.json(posError("bad_request"), { status: 400 });
  }

  const phone = typeof body.phone === "string" ? body.phone : null;
  const result = await createPosCustomer(auth.ctx, {
    firstName,
    lastName: typeof body.lastName === "string" ? body.lastName : null,
    phone,
    email: typeof body.email === "string" ? body.email : null,
    birthDate: typeof body.birthDate === "string" ? body.birthDate : null,
  });
  if (!result.ok) {
    return NextResponse.json(posError(result.error), { status: 400 });
  }

  const qr = await renderMemberQrPng({
    businessId: auth.ctx.businessId,
    customerId: result.customerId,
    memberCode: result.memberCode,
    secret: result.qrSecret,
  });

  // Auto-send the QR membership card over WhatsApp (never fails creation).
  const wa = await sendMemberCardWhatsApp({
    businessId: auth.ctx.businessId,
    customerId: result.customerId,
    memberCode: result.memberCode,
    qrSecret: result.qrSecret,
    name: result.customer.name,
    storeName: auth.ctx.business.name,
    toPhone: phone,
  });

  return NextResponse.json(
    { customer: result.customer, qr, whatsapp: wa.ok ? "sent" : wa.skipped ?? wa.error },
    { headers: { "Cache-Control": "no-store" } },
  );
}
