import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requirePosContext, posError } from "@/lib/pos/context";
import { resolveQr } from "@/lib/pos/service";

export const dynamic = "force-dynamic";

const schema = z.object({ token: z.string().min(1) });

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
    return NextResponse.json(posError("bad_request"), { status: 400 });
  }
  const result = await resolveQr(auth.ctx, parsed.data.token);
  if (!result.ok) {
    return NextResponse.json(posError(result.error), { status: 400 });
  }
  return NextResponse.json(result.customer, {
    headers: { "Cache-Control": "no-store" },
  });
}
