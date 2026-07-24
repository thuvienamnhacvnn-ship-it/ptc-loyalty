import { NextResponse, type NextRequest } from "next/server";
import { requirePosContext, posError } from "@/lib/pos/context";
import { listPosStaff, addPosStaff } from "@/lib/pos/admin";

// GET  /api/pos/staff — list staff (tenant-scoped).
// POST /api/pos/staff — add a staff member (manager+; owner for managers).
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requirePosContext(req);
  if (!auth.ok) return NextResponse.json(posError(auth.error), { status: auth.status });
  const staff = await listPosStaff(auth.ctx);
  return NextResponse.json({ staff }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: NextRequest) {
  const auth = await requirePosContext(req);
  if (!auth.ok) return NextResponse.json(posError(auth.error), { status: auth.status });
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(posError("bad_request"), { status: 400 });
  }
  const res = await addPosStaff(auth.ctx, body);
  if (!res.ok) return NextResponse.json({ error: "bad_request", message: res.error }, { status: 400 });
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
