import { NextResponse, type NextRequest } from "next/server";
import { requirePosContext, posError } from "@/lib/pos/context";
import type { PosSessionInfo, PosRole } from "@/lib/pos/contract";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requirePosContext(req);
  if (!auth.ok) {
    return NextResponse.json(posError(auth.error), { status: auth.status });
  }
  const { ctx } = auth;
  const info: PosSessionInfo = {
    user: {
      id: ctx.user.id,
      name: ctx.user.name ?? null,
      email: ctx.user.email,
      role: ctx.role as PosRole,
    },
    business: ctx.business,
    branches: ctx.branches,
    fixedBranchId: ctx.fixedBranchId,
  };
  return NextResponse.json(info, { headers: { "Cache-Control": "no-store" } });
}
