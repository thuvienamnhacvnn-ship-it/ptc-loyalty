import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Unauthenticated connectivity probe for the desktop client. */
export function GET() {
  return NextResponse.json(
    { ok: true, service: "ptc-bonus-pos", time: new Date().toISOString() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
