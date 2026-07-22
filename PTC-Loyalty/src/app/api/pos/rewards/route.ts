import { NextResponse, type NextRequest } from "next/server";
import { requirePosContext, posError } from "@/lib/pos/context";
import { listRewards } from "@/lib/pos/service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requirePosContext(req);
  if (!auth.ok) {
    return NextResponse.json(posError(auth.error), { status: auth.status });
  }
  const rewards = await listRewards(auth.ctx);
  return NextResponse.json(rewards, { headers: { "Cache-Control": "no-store" } });
}
