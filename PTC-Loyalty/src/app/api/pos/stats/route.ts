import { NextResponse, type NextRequest } from "next/server";
import { requirePosContext, posError } from "@/lib/pos/context";
import { getPosStats } from "@/lib/pos/service";

// GET /api/pos/stats — counter dashboard summary (tenant-scoped).
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requirePosContext(req);
  if (!auth.ok) {
    return NextResponse.json(posError(auth.error), { status: auth.status });
  }
  const stats = await getPosStats(auth.ctx);
  return NextResponse.json(stats, { headers: { "Cache-Control": "no-store" } });
}
