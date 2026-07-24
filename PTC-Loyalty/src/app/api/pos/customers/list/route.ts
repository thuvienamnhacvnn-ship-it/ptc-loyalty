import { NextResponse, type NextRequest } from "next/server";
import { requirePosContext, posError } from "@/lib/pos/context";
import { listPosCustomers } from "@/lib/pos/service";

// GET /api/pos/customers/list?q=&page=&pageSize= — paginated customer list for
// the desktop "Khách hàng" screen (tenant-scoped).
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requirePosContext(req);
  if (!auth.ok) {
    return NextResponse.json(posError(auth.error), { status: auth.status });
  }
  const sp = req.nextUrl.searchParams;
  const result = await listPosCustomers(auth.ctx, {
    q: sp.get("q") ?? undefined,
    page: Number(sp.get("page") ?? 1) || 1,
    pageSize: Number(sp.get("pageSize") ?? 25) || 25,
  });
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
