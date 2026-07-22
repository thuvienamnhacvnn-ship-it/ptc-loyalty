import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { revokeRefreshToken } from "@/lib/pos/token";

export const dynamic = "force-dynamic";

const schema = z.object({ refreshToken: z.string().min(1) });

/** Revoke the device's refresh token. Always returns ok (idempotent). */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (parsed.success) {
      await revokeRefreshToken(parsed.data.refreshToken);
    }
  } catch {
    /* ignore — logout is best-effort */
  }
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
