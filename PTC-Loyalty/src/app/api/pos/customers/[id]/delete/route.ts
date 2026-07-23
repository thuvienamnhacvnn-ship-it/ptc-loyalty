import { NextResponse, type NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { requirePosContext, posError } from "@/lib/pos/context";
import { deletePosCustomer } from "@/lib/pos/service";
import { hasAtLeast } from "@/lib/rbac";

// POST /api/pos/customers/:id/delete — hard-delete a customer from the desktop.
// Owner only, and requires the owner's password in the body for confirmation.
export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requirePosContext(req);
  if (!auth.ok) {
    return NextResponse.json(posError(auth.error), { status: auth.status });
  }
  if (!hasAtLeast(auth.ctx.role, "BUSINESS_OWNER")) {
    return NextResponse.json(posError("forbidden"), { status: 403 });
  }

  const { id } = await params;
  let body: { password?: unknown };
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const password = typeof body.password === "string" ? body.password : "";
  if (!password) {
    return NextResponse.json(posError("bad_request"), { status: 400 });
  }

  // Confirm the acting owner's password before a destructive delete.
  const user = await db.user.findUnique({
    where: { id: auth.ctx.user.id },
    select: { passwordHash: true },
  });
  if (!user?.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
    return NextResponse.json(posError("invalid_password"), { status: 401 });
  }

  const result = await deletePosCustomer(auth.ctx, id);
  if (!result.ok) {
    const status = result.error === "customer_not_found" ? 404 : 400;
    return NextResponse.json(posError(result.error), { status });
  }
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
