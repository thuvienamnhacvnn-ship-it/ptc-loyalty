import { NextResponse, type NextRequest } from "next/server";
import { isAuthorizedCron } from "@/lib/cron-auth";
import { runWinback } from "@/lib/retention";

// GET /api/cron/winback — daily "we miss you" email to customers inactive ≥3 weeks.
// Scheduled via vercel.json crons; protected by CRON_SECRET.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const result = await runWinback();
  console.log("[cron:winback]", JSON.stringify(result));
  return NextResponse.json({ ok: true, ...result });
}
