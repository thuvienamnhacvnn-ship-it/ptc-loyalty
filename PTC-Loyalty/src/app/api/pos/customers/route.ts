import { NextResponse, type NextRequest } from "next/server";
import { requirePosContext, posError } from "@/lib/pos/context";
import { createPosCustomer } from "@/lib/pos/service";
import { renderMemberQrPng } from "@/lib/member-qr";

// POST /api/pos/customers — create a customer from the desktop client and
// return the new PosCustomer + its fixed membership QR (token + PNG data URL).
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const auth = await requirePosContext(req);
  if (!auth.ok) {
    return NextResponse.json(posError(auth.error), { status: auth.status });
  }

  let body: { firstName?: unknown; lastName?: unknown; phone?: unknown; email?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(posError("bad_request"), { status: 400 });
  }

  const firstName = typeof body.firstName === "string" ? body.firstName : "";
  if (!firstName.trim()) {
    return NextResponse.json(posError("bad_request"), { status: 400 });
  }

  const result = await createPosCustomer(auth.ctx, {
    firstName,
    lastName: typeof body.lastName === "string" ? body.lastName : null,
    phone: typeof body.phone === "string" ? body.phone : null,
    email: typeof body.email === "string" ? body.email : null,
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

  return NextResponse.json(
    { customer: result.customer, qr },
    { headers: { "Cache-Control": "no-store" } },
  );
}
