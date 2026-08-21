import { NextResponse, type NextRequest } from "next/server";
import { isAuthorizedCron } from "@/lib/cron-auth";
import { runStaffMonthlySummary } from "@/lib/jobs/staff-monthly";

// GET /api/cron/staff-monthly — gửi bảng tổng kết ngày công cuối tháng cho
// nhân viên qua WhatsApp. Chạy hằng ngày; tự bỏ qua nếu chưa tới ngày cuối
// tháng theo múi giờ của từng quán.
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const result = await runStaffMonthlySummary();
  console.log("[cron:staff-monthly]", JSON.stringify(result));
  return NextResponse.json({ ok: true, ...result });
}
