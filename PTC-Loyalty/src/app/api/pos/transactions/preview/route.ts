import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requirePosContext, posError } from "@/lib/pos/context";
import { previewEarn } from "@/lib/pos/service";

export const dynamic = "force-dynamic";

const schema = z.object({
  customerId: z.string().min(1),
  amount: z.coerce.number().positive(),
});

export async function POST(req: NextRequest) {
  const auth = await requirePosContext(req);
  if (!auth.ok) {
    return NextResponse.json(posError(auth.error), { status: auth.status });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(posError("bad_request"), { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(posError("invalid_amount"), { status: 400 });
  }
  const result = await previewEarn(
    auth.ctx,
    parsed.data.customerId,
    parsed.data.amount,
  );
  if ("error" in result) {
    return NextResponse.json(posError(result.error), { status: 400 });
  }
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
