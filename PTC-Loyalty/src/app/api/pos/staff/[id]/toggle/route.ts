import { NextResponse, type NextRequest } from "next/server";
import { requirePosContext, posError } from "@/lib/pos/context";
import { togglePosStaffActive } from "@/lib/pos/admin";

// POST /api/pos/staff/[id]/toggle — activate/deactivate a staff member.
export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requirePosContext(req);
  if (!auth.ok) return NextResponse.json(posError(auth.error), { status: auth.status });
  const { id } = await params;
  const res = await togglePosStaffActive(auth.ctx, id);
  if (!res.ok) return NextResponse.json({ error: "bad_request", message: res.error }, { status: 400 });
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
