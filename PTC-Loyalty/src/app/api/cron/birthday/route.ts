import { NextResponse, type NextRequest } from "next/server";
import { isAuthorizedCron } from "@/lib/cron-auth";
import { runBirthdayGreetings } from "@/lib/retention";

// GET /api/cron/birthday — daily birthday greetings + auto-birthday vouchers.
// Scheduled via vercel.json crons; protected by CRON_SECRET.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const result = await runBirthdayGreetings();
  console.log("[cron:birthday]", JSON.stringify(result));
  return NextResponse.json({ ok: true, ...result });
}
