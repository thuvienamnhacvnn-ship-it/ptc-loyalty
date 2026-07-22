import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requirePosContext, posError } from "@/lib/pos/context";
import { redeemPoints } from "@/lib/transactions";
import { whatsAppStatusForTxn } from "@/lib/pos/service";
import type { PosTransactionResult } from "@/lib/pos/contract";

export const dynamic = "force-dynamic";

const schema = z.object({
  customerId: z.string().min(1),
  cost: z.coerce.number().int().positive(),
  rewardId: z.string().optional(),
  note: z.string().trim().max(200).optional(),
  idempotencyKey: z.string().min(8).max(200),
  branchId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  let body: z.infer<typeof schema> | undefined;
  try {
    body = schema.parse(await req.json());
  } catch {
    return NextResponse.json(posError("bad_request"), { status: 400 });
  }

  const auth = await requirePosContext(req, body.branchId ?? null);
  if (!auth.ok) {
    return NextResponse.json(posError(auth.error), { status: auth.status });
  }

  const result = await redeemPoints({
    ctx: auth.ctx,
    customerId: body.customerId,
    cost: body.cost,
    rewardId: body.rewardId ?? null,
    note: body.note ?? null,
    idempotencyKey: body.idempotencyKey,
  });

  if (!result.ok) {
    const status = result.error === "customer_not_found" ? 404 : 409;
    return NextResponse.json(posError(result.error), { status });
  }

  const whatsapp = await whatsAppStatusForTxn(auth.ctx, result.transactionId);
  const payload: PosTransactionResult = {
    transactionId: result.transactionId,
    points: result.points,
    balanceAfter: result.balanceAfter,
    whatsapp,
  };
  return NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } });
}
