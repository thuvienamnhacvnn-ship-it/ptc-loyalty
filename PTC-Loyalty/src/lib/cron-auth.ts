import type { NextRequest } from "next/server";

/**
 * Guard for cron endpoints. Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`
 * when the CRON_SECRET env var is set. We require it in production; if it is not
 * configured (local dev), the endpoint is open so it can be triggered manually.
 */
export function isAuthorizedCron(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // dev / not configured
  const header = req.headers.get("authorization") ?? "";
  const key = req.nextUrl.searchParams.get("key");
  return header === `Bearer ${secret}` || key === secret;
}
