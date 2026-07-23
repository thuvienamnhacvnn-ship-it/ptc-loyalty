import { NextResponse, type NextRequest } from "next/server";
import { requirePosContext, posError } from "@/lib/pos/context";
import { updatePosCustomer } from "@/lib/pos/service";
import { hasAtLeast } from "@/lib/rbac";

// POST /api/pos/customers/:id/update — edit a customer from the desktop client.
// Manager+ only. Rejects duplicate phone/email (excluding this customer).
export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requirePosContext(req);
  if (!auth.ok) {
    return NextResponse.json(posError(auth.error), { status: auth.status });
  }
  if (!hasAtLeast(auth.ctx.role, "BUSINESS_MANAGER")) {
    return NextResponse.json(posError("forbidden"), { status: 403 });
  }

  const { id } = await params;
  let body: {
    firstName?: unknown;
    lastName?: unknown;
    phone?: unknown;
    email?: unknown;
    birthDate?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(posError("bad_request"), { status: 400 });
  }

  const firstName = typeof body.firstName === "string" ? body.firstName : "";
  if (!firstName.trim()) {
    return NextResponse.json(posError("bad_request"), { status: 400 });
  }

  const result = await updatePosCustomer(auth.ctx, id, {
    firstName,
    lastName: typeof body.lastName === "string" ? body.lastName : null,
    phone: typeof body.phone === "string" ? body.phone : null,
    email: typeof body.email === "string" ? body.email : null,
    birthDate: typeof body.birthDate === "string" ? body.birthDate : null,
  });
  if (!result.ok) {
    const status = result.error === "customer_not_found" ? 404 : 400;
    return NextResponse.json(posError(result.error), { status });
  }
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
