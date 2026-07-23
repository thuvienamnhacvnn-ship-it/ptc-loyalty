import { NextResponse, type NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { isBusinessStaff } from "@/lib/rbac";
import { createAccessToken, issueRefreshToken } from "@/lib/pos/token";
import { posError } from "@/lib/pos/context";
import {
  checkLoginRateLimit,
  recordFailedLogin,
  clearLoginAttempts,
  loginKey,
} from "@/lib/rate-limit";
import type { PosLoginResponse, PosRole } from "@/lib/pos/contract";

export const dynamic = "force-dynamic";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  deviceLabel: z.string().trim().max(120).optional(),
});

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
  const { email, password, deviceLabel } = parsed.data;
  const key = loginKey(email);

  // Brute-force guard (shared budget with the web login, per email).
  const rl = await checkLoginRateLimit(key);
  if (!rl.allowed) {
    const mins = Math.ceil((rl.retryAfterSec ?? 900) / 60);
    return NextResponse.json(
      { error: "rate_limited", message: `Quá nhiều lần thử. Thử lại sau ${mins} phút.` },
      { status: 429 },
    );
  }

  const user = await db.user.findUnique({
    where: { email: email.toLowerCase() },
  });
  if (!user || !user.passwordHash || !user.isActive) {
    await recordFailedLogin(key);
    return NextResponse.json(posError("invalid_credentials"), { status: 401 });
  }
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    await recordFailedLogin(key);
    return NextResponse.json(posError("invalid_credentials"), { status: 401 });
  }
  await clearLoginAttempts(key); // success → reset counter

  // Only staff/manager/owner of an active business may use the desktop client.
  const staff = await db.staffProfile.findFirst({
    where: { userId: user.id, isActive: true },
    include: { business: true },
    orderBy: { createdAt: "asc" },
  });
  if (!staff) {
    return NextResponse.json(posError("no_business"), { status: 403 });
  }
  if (!isBusinessStaff(staff.role) || staff.business.status === "SUSPENDED") {
    return NextResponse.json(posError("forbidden"), { status: 403 });
  }

  const branches = await db.branch.findMany({
    where: { businessId: staff.businessId, isActive: true },
    select: { id: true, name: true },
    orderBy: { createdAt: "asc" },
  });

  const access = createAccessToken(user.id);
  const refresh = await issueRefreshToken(
    user.id,
    staff.businessId,
    deviceLabel ?? null,
  );

  await db.staffProfile.update({
    where: { id: staff.id },
    data: { lastLoginAt: new Date() },
  });

  const payload: PosLoginResponse = {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: staff.role as PosRole,
    },
    business: {
      id: staff.business.id,
      name: staff.business.name,
      slug: staff.business.slug,
      currency: staff.business.currency,
    },
    branches,
    fixedBranchId: staff.branchId,
    accessToken: access.token,
    accessExpiresAt: access.expiresAt,
    refreshToken: refresh.token,
    refreshExpiresAt: refresh.expiresAt,
  };
  return NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } });
}
