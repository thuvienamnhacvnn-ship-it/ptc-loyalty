import { NextResponse, type NextRequest } from "next/server";
import { requirePosContext, posError } from "@/lib/pos/context";
import { customerDetail } from "@/lib/pos/service";

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
  const detail = await customerDetail(auth.ctx, id);
  if (!detail) {
    return NextResponse.json(posError("customer_not_found"), { status: 404 });
  }
  return NextResponse.json(detail, { headers: { "Cache-Control": "no-store" } });
}
