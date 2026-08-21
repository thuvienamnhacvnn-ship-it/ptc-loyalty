import { NextResponse, type NextRequest } from "next/server";
import { isAuthorizedCron } from "@/lib/cron-auth";
import { runTimeclockAutoClose } from "@/lib/timeclock-jobs";

// GET /api/cron/timeclock — đóng những ca nhân viên quên quét ra.
// Chạy theo crontab của VPS; bảo vệ bằng CRON_SECRET.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const result = await runTimeclockAutoClose();
  console.log("[cron:timeclock]", JSON.stringify(result));
  return NextResponse.json({ ok: true, ...result });
}
