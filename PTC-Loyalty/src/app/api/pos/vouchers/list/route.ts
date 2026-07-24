import { NextResponse, type NextRequest } from "next/server";
import { requirePosContext, posError } from "@/lib/pos/context";
import { listPosVouchers } from "@/lib/pos/service";

// GET /api/pos/vouchers/list — store voucher catalog (tenant-scoped).
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requirePosContext(req);
  if (!auth.ok) {
    return NextResponse.json(posError(auth.error), { status: auth.status });
  }
  const vouchers = await listPosVouchers(auth.ctx);
  return NextResponse.json({ vouchers }, { headers: { "Cache-Control": "no-store" } });
}
