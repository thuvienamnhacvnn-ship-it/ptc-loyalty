import { NextResponse, type NextRequest } from "next/server";
import { requirePosContext, posError } from "@/lib/pos/context";
import { listPosTransactions } from "@/lib/pos/service";

// GET /api/pos/transactions/list?page=&pageSize=&customerId= — store-wide
// transaction history (tenant-scoped, paginated).
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requirePosContext(req);
  if (!auth.ok) {
    return NextResponse.json(posError(auth.error), { status: auth.status });
  }
  const sp = req.nextUrl.searchParams;
  const result = await listPosTransactions(auth.ctx, {
    page: Number(sp.get("page") ?? 1) || 1,
    pageSize: Number(sp.get("pageSize") ?? 25) || 25,
    customerId: sp.get("customerId") ?? undefined,
  });
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
