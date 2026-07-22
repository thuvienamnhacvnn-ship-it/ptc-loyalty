import { NextResponse, type NextRequest } from "next/server";
import { requirePosContext, posError } from "@/lib/pos/context";
import { customerQrData } from "@/lib/pos/service";
import { renderMemberQrPng } from "@/lib/member-qr";

// GET /api/pos/customers/:id/qr — fixed membership QR (token + PNG) for an
// existing customer, so the desktop client can display/print it.
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requirePosContext(req);
  if (!auth.ok) {
    return NextResponse.json(posError(auth.error), { status: auth.status });
  }
  const { id } = await params;
  const data = await customerQrData(auth.ctx, id);
  if (!data) {
    return NextResponse.json(posError("customer_not_found"), { status: 404 });
  }
  const qr = await renderMemberQrPng(data);
  return NextResponse.json(qr, { headers: { "Cache-Control": "no-store" } });
}
