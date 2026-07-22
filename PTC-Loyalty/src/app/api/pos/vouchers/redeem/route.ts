import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requirePosContext, posError } from "@/lib/pos/context";
import { redeemVoucher } from "@/lib/pos/service";
import type { PosVoucherRedeemResult } from "@/lib/pos/contract";

export const dynamic = "force-dynamic";

const schema = z.object({ code: z.string().trim().min(1).max(64) });

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
  const result = await redeemVoucher(auth.ctx, parsed.data.code);
  if (!result.ok) {
    return NextResponse.json(posError(result.error), { status: 400 });
  }
  const payload: PosVoucherRedeemResult = {
    voucherId: result.voucherId,
    code: result.code,
    title: result.title,
  };
  return NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } });
}
