import { db } from "@/lib/db";

// Rolling-window brute-force protection for login, backed by the DB (shared
// across serverless instances, unlike in-memory counters).
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 10; // failed attempts allowed per window before a block

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSec?: number;
}

/** Is this key currently allowed to attempt a login? (does not record) */
export async function checkLoginRateLimit(key: string): Promise<RateLimitResult> {
  const now = Date.now();
  const record = await db.loginAttempt.findUnique({ where: { key } });
  if (record?.blockedUntil && record.blockedUntil.getTime() > now) {
    return {
      allowed: false,
      retryAfterSec: Math.ceil((record.blockedUntil.getTime() - now) / 1000),
    };
  }
  return { allowed: true };
}

/** Record a failed login; blocks the key once it exceeds the window budget. */
export async function recordFailedLogin(key: string): Promise<void> {
  const now = new Date();
  const record = await db.loginAttempt.findUnique({ where: { key } });

  // Start a fresh window if none exists or the previous one expired.
  if (!record || now.getTime() - record.windowStart.getTime() > WINDOW_MS) {
    await db.loginAttempt.upsert({
      where: { key },
      create: { key, count: 1, windowStart: now, blockedUntil: null },
      update: { count: 1, windowStart: now, blockedUntil: null },
    });
    return;
  }

  const count = record.count + 1;
  const blockedUntil =
    count >= MAX_ATTEMPTS ? new Date(now.getTime() + WINDOW_MS) : record.blockedUntil;
  await db.loginAttempt.update({ where: { key }, data: { count, blockedUntil } });
}

/** Clear attempts after a successful login. */
export async function clearLoginAttempts(key: string): Promise<void> {
  await db.loginAttempt.deleteMany({ where: { key } });
}

export function loginKey(email: string): string {
  return `login:${email.trim().toLowerCase()}`;
}
