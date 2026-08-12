import { NextResponse, type NextRequest } from "next/server";
import { isAuthorizedCron } from "@/lib/cron-auth";
import { runAppointmentReminders } from "@/lib/jobs/appointment-reminders";

// GET /api/cron/appointment-reminders — WhatsApp reminders for upcoming appointments.
// Runs every 15 min from the VPS crontab (see deploy/README.md); protected by CRON_SECRET.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const result = await runAppointmentReminders();
  console.log("[cron:appointment-reminders]", JSON.stringify(result));
  return NextResponse.json({ ok: true, ...result });
}
