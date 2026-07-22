import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  consumeRefreshToken,
  createAccessToken,
  issueRefreshToken,
} from "@/lib/pos/token";
import { posError } from "@/lib/pos/context";
import type { PosRefreshResponse } from "@/lib/pos/contract";

export const dynamic = "force-dynamic";

const schema = z.object({ refreshToken: z.string().min(10) });

export async function POST(req: NextRequest) {
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

  // Rotate: the presented refresh token is consumed (revoked) and replaced.
  const consumed = await consumeRefreshToken(parsed.data.refreshToken);
  if (!consumed.ok) {
    return NextResponse.json(posError("unauthorized"), { status: 401 });
  }

  const user = await db.user.findUnique({ where: { id: consumed.userId } });
  if (!user || !user.isActive) {
    return NextResponse.json(posError("unauthorized"), { status: 401 });
  }
  const staff = await db.staffProfile.findFirst({
    where: { userId: user.id, isActive: true },
    orderBy: { createdAt: "asc" },
    select: { businessId: true },
  });

  const access = createAccessToken(user.id);
  const refresh = await issueRefreshToken(
    user.id,
    staff?.businessId ?? null,
    null,
  );

  const payload: PosRefreshResponse = {
    accessToken: access.token,
    accessExpiresAt: access.expiresAt,
    refreshToken: refresh.token,
    refreshExpiresAt: refresh.expiresAt,
  };
  return NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } });
}
