import { NextResponse, type NextRequest } from "next/server";
import { requirePosContext, posError } from "@/lib/pos/context";
import { searchCustomer } from "@/lib/pos/service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requirePosContext(req);
  if (!auth.ok) {
    return NextResponse.json(posError(auth.error), { status: auth.status });
  }
  const q = req.nextUrl.searchParams.get("q") ?? "";
  const result = await searchCustomer(auth.ctx, q);
  if (!result.ok) {
    return NextResponse.json(posError(result.error), { status: 404 });
  }
  return NextResponse.json(result.customer, {
    headers: { "Cache-Control": "no-store" },
  });
}
